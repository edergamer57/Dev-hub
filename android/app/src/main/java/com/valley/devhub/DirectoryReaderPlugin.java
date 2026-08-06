package com.valley.devhub;

import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

// Custom plugin: lets the web code pick a real folder on disk (via the
// Android system folder picker / SAF), recursively list every file inside
// it, and read/write those files directly - all the pieces that
// @capacitor/filesystem doesn't support for content:// trees.
@CapacitorPlugin(name = "DirectoryReader")
public class DirectoryReaderPlugin extends Plugin {

    // Folders we never want to walk into (same list used on the web build).
    private static final Set<String> SKIP_DIRS = new HashSet<>(
            Arrays.asList("node_modules", ".git", "dist", "build", ".vscode")
    );

    @PluginMethod
    public void pickDirectory(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION
                        | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                        | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        );
        startActivityForResult(call, intent, "pickDirectoryResult");
    }

    @ActivityCallback
    private void pickDirectoryResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != android.app.Activity.RESULT_OK || result.getData() == null) {
            call.reject("No folder selected");
            return;
        }
        Uri treeUri = result.getData().getData();
        if (treeUri == null) {
            call.reject("No folder selected");
            return;
        }

        // Keep permission to read/write this folder across app restarts.
        getContext().getContentResolver().takePersistableUriPermission(
                treeUri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        );

        JSObject ret = new JSObject();
        ret.put("uri", treeUri.toString());
        call.resolve(ret);
    }

    @PluginMethod
    public void listTree(PluginCall call) {
        String treeUriString = call.getString("uri");
        if (treeUriString == null) {
            call.reject("Missing 'uri'");
            return;
        }
        try {
            Uri treeUri = Uri.parse(treeUriString);
            String rootDocId = DocumentsContract.getTreeDocumentId(treeUri);
            JSArray results = new JSArray();
            walk(treeUri, rootDocId, "", results);
            JSObject ret = new JSObject();
            ret.put("files", results);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to list directory: " + e.getMessage(), e);
        }
    }

    private void walk(Uri treeUri, String parentDocId, String relPath, JSArray out) {
        ContentResolver resolver = getContext().getContentResolver();
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, parentDocId);
        String[] projection = new String[]{
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE
        };

        try (Cursor cursor = resolver.query(childrenUri, projection, null, null, null)) {
            if (cursor == null) return;
            while (cursor.moveToNext()) {
                String docId = cursor.getString(0);
                String name = cursor.getString(1);
                String mime = cursor.getString(2);
                String childRel = relPath.isEmpty() ? name : relPath + "/" + name;
                boolean isDir = DocumentsContract.Document.MIME_TYPE_DIR.equals(mime);

                if (isDir) {
                    if (!SKIP_DIRS.contains(name)) {
                        walk(treeUri, docId, childRel, out);
                    }
                } else {
                    Uri docUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, docId);
                    JSObject entry = new JSObject();
                    entry.put("name", name);
                    entry.put("rel", childRel);
                    entry.put("uri", docUri.toString());
                    out.put(entry);
                }
            }
        } catch (Exception e) {
            // Some providers throw on odd subfolders (permission quirks) -
            // skip that branch instead of failing the whole listing.
        }
    }

    @PluginMethod
    public void readTextFile(PluginCall call) {
        String uriString = call.getString("uri");
        if (uriString == null) {
            call.reject("Missing 'uri'");
            return;
        }
        try (InputStream is = getContext().getContentResolver().openInputStream(Uri.parse(uriString))) {
            if (is == null) {
                call.reject("Could not open file");
                return;
            }
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int read;
            while ((read = is.read(chunk)) != -1) {
                buffer.write(chunk, 0, read);
            }
            JSObject ret = new JSObject();
            ret.put("data", buffer.toString("UTF-8"));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to read file: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void writeTextFile(PluginCall call) {
        String uriString = call.getString("uri");
        String data = call.getString("data");
        if (uriString == null || data == null) {
            call.reject("Missing 'uri' or 'data'");
            return;
        }
        try (OutputStream os = getContext().getContentResolver().openOutputStream(Uri.parse(uriString), "wt")) {
            if (os == null) {
                call.reject("Could not open file for writing");
                return;
            }
            os.write(data.getBytes(StandardCharsets.UTF_8));
            os.flush();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to write file: " + e.getMessage(), e);
        }
    }
}
