package dev.mimi.danceapp.ui.favorites

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.mimi.danceapp.api.FavoriteItem
import dev.mimi.danceapp.data.Repository
import dev.mimi.danceapp.ui.components.VideoCard
import dev.mimi.danceapp.ui.theme.DarkText
import dev.mimi.danceapp.ui.theme.Pink400
import dev.mimi.danceapp.ui.theme.PinkLight

@Composable
fun FavoritesScreen(onVideoClick: (Int) -> Unit) {
    var items by remember { mutableStateOf<List<FavoriteItem>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try {
            items = Repository.getFavorites().items
        } catch (e: Exception) {
            error = e.message
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(PinkLight)
    ) {
        when {
            error != null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Error: $error", color = Color.Red)
            }
            items == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Pink400)
            }
            items!!.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("🩰", fontSize = 64.sp)
                    Spacer(Modifier.height(16.dp))
                    Text("No favourites yet", fontSize = 20.sp, color = DarkText, fontWeight = FontWeight.Medium)
                    Text("Press ♥ while watching a video", fontSize = 14.sp, color = Color(0xFF9ca3af))
                }
            }
            else -> Column(modifier = Modifier.fillMaxSize()) {
                Text(
                    "Favourites",
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    color = Pink400,
                    modifier = Modifier.padding(horizontal = 48.dp, vertical = 24.dp)
                )
                LazyVerticalGrid(
                    columns = GridCells.Adaptive(minSize = 200.dp),
                    contentPadding = PaddingValues(horizontal = 48.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(items!!) { v ->
                        VideoCard(
                            id = v.id,
                            title = v.title,
                            durationSec = v.durationSec,
                            hasThumb = v.hasThumb,
                            position = v.position,
                            watched = v.watched,
                            onClick = { onVideoClick(v.id) }
                        )
                    }
                }
            }
        }
    }
}
