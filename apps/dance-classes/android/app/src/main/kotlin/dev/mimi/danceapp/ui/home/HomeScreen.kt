package dev.mimi.danceapp.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.mimi.danceapp.api.*
import dev.mimi.danceapp.data.Repository
import dev.mimi.danceapp.ui.components.FolderCard
import dev.mimi.danceapp.ui.components.VideoCard
import dev.mimi.danceapp.ui.theme.DarkText
import dev.mimi.danceapp.ui.theme.Pink400
import dev.mimi.danceapp.ui.theme.PinkLight
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

data class HomeData(
    val continueItems: List<ContinueItem>,
    val favorites: List<FavoriteItem>,
    val rootFolders: List<FolderItem>,
    val rootVideos: List<VideoItem>
)

@Composable
fun HomeScreen(
    onFolderClick: (Int) -> Unit,
    onVideoClick: (Int) -> Unit
) {
    var data by remember { mutableStateOf<HomeData?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try {
            coroutineScope {
                val continueDeferred = async { Repository.getContinue() }
                val favDeferred = async { Repository.getFavorites() }
                val rootDeferred = async { Repository.getRootFolder() }
                val continueRes = continueDeferred.await()
                val favRes = favDeferred.await()
                val rootRes = rootDeferred.await()
                data = HomeData(continueRes.items, favRes.items, rootRes.folders, rootRes.videos)
            }
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
            error != null -> ErrorMsg(error!!)
            data == null -> LoadingSpinner()
            else -> HomeContent(data!!, onFolderClick, onVideoClick)
        }
    }
}

@Composable
private fun HomeContent(
    data: HomeData,
    onFolderClick: (Int) -> Unit,
    onVideoClick: (Int) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(vertical = 24.dp)
    ) {
        item {
            Header()
        }

        if (data.continueItems.isNotEmpty()) {
            item { SectionTitle("Continue Watching") }
            item {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 48.dp),
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    items(data.continueItems) { v ->
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
                Spacer(Modifier.height(24.dp))
            }
        }

        if (data.favorites.isNotEmpty()) {
            item { SectionTitle("Favourites") }
            item {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 48.dp),
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    items(data.favorites) { v ->
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
                Spacer(Modifier.height(24.dp))
            }
        }

        item { SectionTitle("Library") }

        items(data.rootFolders) { folder ->
            Row(
                modifier = Modifier.padding(horizontal = 48.dp, vertical = 4.dp)
            ) {
                FolderCard(
                    id = folder.id,
                    name = folder.name,
                    childCount = folder.childCount,
                    thumbVideoIds = folder.thumbVideoIds,
                    onClick = { onFolderClick(folder.id) }
                )
            }
        }

        if (data.rootVideos.isNotEmpty()) {
            items(data.rootVideos) { v ->
                Row(modifier = Modifier.padding(horizontal = 48.dp, vertical = 4.dp)) {
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

        item { Spacer(Modifier.height(48.dp)) }
    }
}

@Composable
private fun Header() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 48.dp, vertical = 16.dp)
    ) {
        Text(
            text = "Mimi's Dance Wonderland 🩰",
            fontSize = 32.sp,
            fontWeight = FontWeight.Bold,
            color = Pink400
        )
        Text(
            text = "Your ballet & dance class library",
            fontSize = 16.sp,
            color = Color(0xFF9ca3af)
        )
    }
}

@Composable
private fun SectionTitle(title: String) {
    Text(
        text = title,
        fontSize = 20.sp,
        fontWeight = FontWeight.SemiBold,
        color = DarkText,
        modifier = Modifier.padding(horizontal = 48.dp, vertical = 8.dp)
    )
}

@Composable
private fun LoadingSpinner() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = Pink400)
    }
}

@Composable
private fun ErrorMsg(msg: String) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text("Failed to load: $msg", color = Color.Red)
    }
}
