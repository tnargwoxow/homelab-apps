package dev.mimi.danceapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import dev.mimi.danceapp.ui.theme.Pink400
import dev.mimi.danceapp.ui.theme.PinkLight

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = Pink400,
                    background = PinkLight,
                    surface = PinkLight
                )
            ) {
                DanceApp()
            }
        }
    }
}
