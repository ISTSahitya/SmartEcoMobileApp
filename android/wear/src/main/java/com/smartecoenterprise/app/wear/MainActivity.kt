package com.smartecoenterprise.app.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.TimeText
import com.smartecoenterprise.app.wear.ui.WearApp
import com.smartecoenterprise.app.wear.ui.theme.SmartEcoWearTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Must run before super.onCreate() — it swaps Theme.SmartEcoWear.Splash
        // for the postSplashScreenTheme declared in themes.xml.
        installSplashScreen()
        super.onCreate(savedInstanceState)

        setContent {
            SmartEcoWearTheme {
                // Scaffold hosts TimeText once for the whole app rather than per
                // screen, so the clock does not flicker across navigation.
                Scaffold(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(MaterialTheme.colors.background),
                    timeText = { TimeText() },
                ) {
                    WearApp()
                }
            }
        }
    }
}
