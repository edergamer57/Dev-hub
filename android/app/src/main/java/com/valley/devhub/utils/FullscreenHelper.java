package com.valley.devhub.utils;

import android.app.Activity;
import android.view.View;

public class FullscreenHelper {

    public static void enable(Activity activity) {

        activity.getWindow()
            .getDecorView()
            .setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            );
    }
}