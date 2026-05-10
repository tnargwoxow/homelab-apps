package dev.mimi.danceapp

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import dev.mimi.danceapp.ui.favorites.FavoritesScreen
import dev.mimi.danceapp.ui.folder.FolderScreen
import dev.mimi.danceapp.ui.home.HomeScreen
import dev.mimi.danceapp.ui.player.PlayerScreen
import dev.mimi.danceapp.ui.search.SearchScreen
import dev.mimi.danceapp.ui.theme.PinkLight

@Composable
fun DanceApp() {
    val navController = rememberNavController()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(PinkLight)
    ) {
        NavHost(navController = navController, startDestination = "home") {

            composable("home") {
                HomeScreen(
                    onFolderClick = { id -> navController.navigate("folder/$id") },
                    onVideoClick = { id -> navController.navigate("player/$id") }
                )
            }

            composable("folder/{id}") { back ->
                val id = back.arguments?.getString("id")?.toIntOrNull() ?: return@composable
                FolderScreen(
                    folderId = id,
                    onFolderClick = { fid -> navController.navigate("folder/$fid") },
                    onVideoClick = { vid -> navController.navigate("player/$vid") },
                    onBreadcrumbClick = { crumbId ->
                        if (crumbId == null) {
                            navController.popBackStack("home", inclusive = false)
                        } else {
                            navController.navigate("folder/$crumbId")
                        }
                    }
                )
            }

            composable("player/{id}") { back ->
                val id = back.arguments?.getString("id")?.toIntOrNull() ?: return@composable
                PlayerScreen(
                    videoId = id,
                    onBack = { navController.popBackStack() },
                    onNavigateToVideo = { nextId ->
                        navController.navigate("player/$nextId") {
                            popUpTo("player/$id") { inclusive = true }
                        }
                    }
                )
            }

            composable("search") {
                SearchScreen(
                    onVideoClick = { id -> navController.navigate("player/$id") },
                    onFolderClick = { id -> navController.navigate("folder/$id") }
                )
            }

            composable("favorites") {
                FavoritesScreen(
                    onVideoClick = { id -> navController.navigate("player/$id") }
                )
            }
        }
    }
}
