package dev.mimi.danceapp.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
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
import coil.compose.AsyncImage
import dev.mimi.danceapp.data.Repository
import dev.mimi.danceapp.ui.theme.Pink400
import dev.mimi.danceapp.ui.theme.PinkLight

@Composable
fun VideoCard(
    id: Int,
    title: String,
    durationSec: Double?,
    hasThumb: Boolean,
    position: Double,
    watched: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    var focused by remember { mutableStateOf(false) }
    val progress = if (durationSec != null && durationSec > 0) (position / durationSec).toFloat().coerceIn(0f, 1f) else 0f

    Card(
        onClick = onClick,
        modifier = modifier
            .width(200.dp)
            .onFocusChanged { focused = it.isFocused }
            .scale(if (focused) 1.05f else 1f)
            .border(
                width = if (focused) 3.dp else 1.dp,
                color = if (focused) Pink400 else Color.Transparent,
                shape = RoundedCornerShape(12.dp)
            ),
        shape = CardDefaults.shape(RoundedCornerShape(12.dp)),
        colors = CardDefaults.colors(containerColor = Color.White)
    ) {
        Box {
            if (hasThumb) {
                AsyncImage(
                    model = Repository.thumbUrl(id),
                    contentDescription = title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(112.dp)
                        .clip(RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp))
                )
            } else {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(112.dp)
                        .background(PinkLight),
                    contentAlignment = Alignment.Center
                ) {
                    Text("🩰", fontSize = 32.sp)
                }
            }
            if (watched) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(6.dp)
                        .background(Pink400, RoundedCornerShape(6.dp))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text("✓", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
        if (progress > 0f && !watched) {
            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier.fillMaxWidth().height(3.dp),
                color = Pink400,
                trackColor = PinkLight
            )
        }
        Column(modifier = Modifier.padding(8.dp)) {
            Text(
                text = title,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                color = Color(0xFF1a1a2e)
            )
            if (durationSec != null) {
                Text(
                    text = formatDuration(durationSec),
                    fontSize = 11.sp,
                    color = Color(0xFF9ca3af)
                )
            }
        }
    }
}

fun formatDuration(secs: Double): String {
    val total = secs.toInt()
    val h = total / 3600
    val m = (total % 3600) / 60
    val s = total % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}
