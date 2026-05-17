package dev.mimi.danceapp.ui.player

import android.view.KeyEvent
import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import dev.mimi.danceapp.api.VideoDetail
import dev.mimi.danceapp.data.Repository
import dev.mimi.danceapp.ui.components.formatDuration
import dev.mimi.danceapp.ui.theme.Pink400
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val SPEEDS = listOf(0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f)

@Composable
fun PlayerScreen(
    videoId: Int,
    onBack: () -> Unit,
    onNavigateToVideo: (Int) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var meta by remember { mutableStateOf<VideoDetail?>(null) }
    var overlayVisible by remember { mutableStateOf(true) }
    var speedIndex by remember { mutableStateOf(2) } // default 1.0x
    var isFavorite by remember { mutableStateOf(false) }
    var isWatched by remember { mutableStateOf(false) }
    var currentPosition by remember { mutableStateOf(0L) }
    var duration by remember { mutableStateOf(0L) }
    val overlayFocus = remember { FocusRequester() }

    val player = remember {
        ExoPlayer.Builder(context).build()
    }

    // Load metadata
    LaunchedEffect(videoId) {
        try {
            meta = Repository.getVideo(videoId)
            meta?.let {
                isFavorite = it.favorite
                isWatched = it.watched
                val item = MediaItem.fromUri(Repository.streamUrl(videoId))
                player.setMediaItem(item)
                player.prepare()
                if (it.position > 5) {
                    player.seekTo((it.position * 1000).toLong())
                }
                player.play()
            }
        } catch (_: Exception) { }
    }

    // Listen for playback state changes (auto-play next)
    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_ENDED) {
                    val nextId = meta?.nextId
                    if (nextId != null) {
                        onNavigateToVideo(nextId)
                    } else {
                        onBack()
                    }
                }
            }
        }
        player.addListener(listener)
        onDispose { player.removeListener(listener) }
    }

    // Progress polling — save position every 5s
    LaunchedEffect(player) {
        while (true) {
            delay(5_000)
            if (player.isPlaying) {
                val pos = player.currentPosition / 1000.0
                val dur = player.duration.takeIf { it > 0 }?.let { it / 1000.0 }
                currentPosition = player.currentPosition
                duration = player.duration.coerceAtLeast(0)
                scope.launch { Repository.saveProgress(videoId, pos, dur) }
            }
        }
    }

    // Poll UI position for the overlay progress bar
    LaunchedEffect(player) {
        while (true) {
            delay(500)
            currentPosition = player.currentPosition.coerceAtLeast(0)
            duration = player.duration.coerceAtLeast(0)
        }
    }

    // Auto-hide overlay
    LaunchedEffect(overlayVisible) {
        if (overlayVisible) {
            delay(4_000)
            overlayVisible = false
        }
    }

    // Save final position on exit
    DisposableEffect(videoId) {
        onDispose {
            val pos = player.currentPosition / 1000.0
            val dur = player.duration.takeIf { it > 0 }?.let { it / 1000.0 }
            scope.launch { Repository.saveProgress(videoId, pos, dur) }
            player.release()
        }
    }

    BackHandler {
        if (overlayVisible) onBack() else overlayVisible = true
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .onKeyEvent { event ->
                if (event.type == KeyEventType.KeyDown) {
                    when (event.key) {
                        Key.DirectionCenter, Key.Enter -> { overlayVisible = !overlayVisible; true }
                        Key.DirectionLeft -> { player.seekTo((player.currentPosition - 10_000).coerceAtLeast(0)); overlayVisible = true; true }
                        Key.DirectionRight -> { player.seekTo(player.currentPosition + 10_000); overlayVisible = true; true }
                        Key.MediaPlayPause, Key.MediaPlay, Key.MediaPause -> {
                            if (player.isPlaying) player.pause() else player.play()
                            overlayVisible = true
                            true
                        }
                        else -> false
                    }
                } else false
            }
    ) {
        // Video player
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    this.player = player
                    useController = false
                }
            },
            modifier = Modifier.fillMaxSize()
        )

        // Overlay
        AnimatedVisibility(
            visible = overlayVisible,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.align(Alignment.BottomCenter)
        ) {
            PlayerOverlay(
                meta = meta,
                currentPositionMs = currentPosition,
                durationMs = duration,
                isPlaying = player.isPlaying,
                speedIndex = speedIndex,
                isFavorite = isFavorite,
                isWatched = isWatched,
                focusRequester = overlayFocus,
                onPlayPause = {
                    if (player.isPlaying) player.pause() else player.play()
                },
                onSeekBack = { player.seekTo((player.currentPosition - 10_000).coerceAtLeast(0)) },
                onSeekForward = { player.seekTo(player.currentPosition + 10_000) },
                onSpeedCycle = {
                    speedIndex = (speedIndex + 1) % SPEEDS.size
                    player.setPlaybackSpeed(SPEEDS[speedIndex])
                },
                onFavoriteToggle = {
                    scope.launch {
                        if (isFavorite) Repository.removeFavorite(videoId)
                        else Repository.addFavorite(videoId)
                        isFavorite = !isFavorite
                    }
                },
                onWatchedToggle = {
                    scope.launch {
                        Repository.setWatched(videoId, !isWatched)
                        isWatched = !isWatched
                    }
                }
            )
        }

        LaunchedEffect(overlayVisible) {
            if (overlayVisible) {
                try { overlayFocus.requestFocus() } catch (_: Exception) { }
            }
        }
    }
}

@Composable
private fun PlayerOverlay(
    meta: VideoDetail?,
    currentPositionMs: Long,
    durationMs: Long,
    isPlaying: Boolean,
    speedIndex: Int,
    isFavorite: Boolean,
    isWatched: Boolean,
    focusRequester: FocusRequester,
    onPlayPause: () -> Unit,
    onSeekBack: () -> Unit,
    onSeekForward: () -> Unit,
    onSpeedCycle: () -> Unit,
    onFavoriteToggle: () -> Unit,
    onWatchedToggle: () -> Unit
) {
    val progress = if (durationMs > 0) currentPositionMs.toFloat() / durationMs else 0f

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.Black.copy(alpha = 0.75f))
            .padding(horizontal = 48.dp, vertical = 24.dp)
            .focusRequester(focusRequester)
    ) {
        // Title
        if (meta != null) {
            Text(
                text = meta.title,
                color = Color.White,
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(Modifier.height(8.dp))
        }

        // Progress bar
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier.fillMaxWidth().height(4.dp),
            color = Pink400,
            trackColor = Color.White.copy(alpha = 0.3f)
        )
        Spacer(Modifier.height(4.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(formatDuration(currentPositionMs / 1000.0), color = Color.White, fontSize = 12.sp)
            if (durationMs > 0) Text(formatDuration(durationMs / 1000.0), color = Color.White, fontSize = 12.sp)
        }

        Spacer(Modifier.height(16.dp))

        // Controls row
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Seek back
            OverlayButton("⏪ 10s", onClick = onSeekBack)

            // Play/pause
            OverlayButton(if (isPlaying) "⏸" else "▶", highlight = true, onClick = onPlayPause)

            // Seek forward
            OverlayButton("10s ⏩", onClick = onSeekForward)

            Spacer(Modifier.weight(1f))

            // Speed
            OverlayButton("${SPEEDS[speedIndex]}×", onClick = onSpeedCycle)

            // Favourite
            OverlayButton(if (isFavorite) "♥" else "♡", highlight = isFavorite, onClick = onFavoriteToggle)

            // Watched
            OverlayButton(if (isWatched) "✓ Watched" else "Mark Watched", onClick = onWatchedToggle)
        }
    }
}

@Composable
private fun OverlayButton(
    label: String,
    highlight: Boolean = false,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        colors = ButtonDefaults.buttonColors(
            containerColor = if (highlight) Pink400 else Color.White.copy(alpha = 0.15f),
            contentColor = Color.White
        ),
        shape = RoundedCornerShape(8.dp),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
    ) {
        Text(label, fontSize = 14.sp)
    }
}
