package dev.mimi.danceapp.ui.folder

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.mimi.danceapp.api.FolderResponse
import dev.mimi.danceapp.data.Repository
import dev.mimi.danceapp.ui.components.FolderCard
import dev.mimi.danceapp.ui.components.VideoCard
import dev.mimi.danceapp.ui.theme.DarkText
import dev.mimi.danceapp.ui.theme.Pink400
import dev.mimi.danceapp.ui.theme.PinkLight

@Composable
fun FolderScreen(
    folderId: Int,
    onFolderClick: (Int) -> Unit,
    onVideoClick: (Int) -> Unit,
    onBreadcrumbClick: (Int?) -> Unit
) {
    var folderData by remember { mutableStateOf<FolderResponse?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(folderId) {
        folderData = null
        error = null
        try {
            folderData = Repository.getFolder(folderId)
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
            folderData == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Pink400)
            }
            else -> FolderContent(folderData!!, onFolderClick, onVideoClick, onBreadcrumbClick)
        }
    }
}

@Composable
private fun FolderContent(
    data: FolderResponse,
    onFolderClick: (Int) -> Unit,
    onVideoClick: (Int) -> Unit,
    onBreadcrumbClick: (Int?) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(vertical = 24.dp)
    ) {
        // Breadcrumb
        item {
            Row(
                modifier = Modifier.padding(horizontal = 48.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = { onBreadcrumbClick(null) }) {
                    Text("Home", color = Pink400, fontWeight = FontWeight.Medium)
                }
                data.breadcrumb.forEach { crumb ->
                    Text(" › ", color = Color(0xFF9ca3af))
                    TextButton(onClick = { onBreadcrumbClick(crumb.id) }) {
                        Text(crumb.name, color = Pink400, fontWeight = FontWeight.Medium)
                    }
                }
                Text(" › ", color = Color(0xFF9ca3af))
                Text(data.folder.name, color = DarkText, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            }
        }

        // Subfolders
        if (data.folders.isNotEmpty()) {
            item {
                Text(
                    "Folders",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = DarkText,
                    modifier = Modifier.padding(horizontal = 48.dp, vertical = 4.dp)
                )
            }
            item {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 48.dp),
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    items(data.folders) { folder ->
                        FolderCard(
                            id = folder.id,
                            name = folder.name,
                            childCount = folder.childCount,
                            thumbVideoIds = folder.thumbVideoIds,
                            onClick = { onFolderClick(folder.id) }
                        )
                    }
                }
                Spacer(Modifier.height(24.dp))
            }
        }

        // Videos
        if (data.videos.isNotEmpty()) {
            item {
                Text(
                    "Videos",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = DarkText,
                    modifier = Modifier.padding(horizontal = 48.dp, vertical = 4.dp)
                )
            }
            items(data.videos) { v ->
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
