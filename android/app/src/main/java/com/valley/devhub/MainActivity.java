package com.valley.devhub;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.valley.devhub.utils.FullscreenHelper;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DirectoryReaderPlugin.class);
        super.onCreate(savedInstanceState);

        FullscreenHelper.enable(this);
    }
}
