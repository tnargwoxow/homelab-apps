package dev.mimi.danceapp.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Card
import androidx.tv.material3.CardDefaults
import androidx.tv.material3.ExperimentalTvMaterial3Api
import coil.compose.AsyncImage
import dev.mimi.danceapp.data.Repository
import dev.mimi.danceapp.ui.theme.Pink400
import dev.mimi.danceapp.ui.theme.PinkLight

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
fun FolderCard(
    id: Int,
    name: String,
    childCount: Int,
    thumbVideoIds: List<Int>,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    var focused by remember { mutableStateOf(false) }

    Card(
        onClick = onClick,
        modifier = modifier
            .width(220.dp)
            .onFocusChanged { focused = it.isFocused }
            .scale(if (focused) 1.05f else 1f)
            .border(
                width = if (focused) 3.dp else 1.dp,
                color = if (focused) Pink400 else Color.Transparent,
                shape = RoundedCornerShape(12.dp)
            ),
        shape = CardDefaults.shape(RoundedCornerShape(12.dp)),
        colors = CardDefaults.colors(containerColor = Color.White, focusedContainerColor = Color.White)
    ) {
        // Mosaic or fallback thumbnail
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(124.dp)
                .clip(RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp))
        ) {
            when {
                thumbVideoIds.size >= 4 -> Mosaic4(thumbVideoIds)
                thumbVideoIds.size == 2 || thumbVideoIds.size == 3 -> Mosaic2(thumbVideoIds)
                thumbVideoIds.size == 1 -> SingleThumb(thumbVideoIds[0])
                else -> FolderIcon()
            }
        }
        Column(modifier = Modifier.padding(8.dp)) {
            Text(
                text = name,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                color = Color(0xFF1a1a2e)
            )
            Text(
                text = "$childCount items",
                fontSize = 11.sp,
                color = Color(0xFF9ca3af)
            )
        }
    }
}

@Composable
private fun Mosaic4(ids: List<Int>) {
    Row(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.weight(1f)) {
            ThumbImg(ids[0], Modifier.weight(1f).fillMaxWidth())
            ThumbImg(ids[1], Modifier.weight(1f).fillMaxWidth())
        }
        Column(modifier = Modifier.weight(1f)) {
            ThumbImg(ids[2], Modifier.weight(1f).fillMaxWidth())
            ThumbImg(ids[3], Modifier.weight(1f).fillMaxWidth())
        }
    }
}

@Composable
private fun Mosaic2(ids: List<Int>) {
    Row(modifier = Modifier.fillMaxSize()) {
        ThumbImg(ids[0], Modifier.weight(1f).fillMaxHeight())
        ThumbImg(ids[1], Modifier.weight(1f).fillMaxHeight())
    }
}

@Composable
private fun SingleThumb(id: Int) {
    ThumbImg(id, Modifier.fillMaxSize())
}

@Composable
private fun ThumbImg(videoId: Int, modifier: Modifier) {
    AsyncImage(
        model = Repository.thumbUrl(videoId),
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = modifier
    )
}

@Composable
private fun FolderIcon() {
    Box(
        modifier = Modifier.fillMaxSize().background(PinkLight),
        contentAlignment = Alignment.Center
    ) {
        Text("📁", fontSize = 40.sp)
    }
}
