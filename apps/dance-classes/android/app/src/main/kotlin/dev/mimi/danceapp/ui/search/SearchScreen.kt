package dev.mimi.danceapp.ui.search

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.mimi.danceapp.api.SearchResult
import dev.mimi.danceapp.data.Repository
import dev.mimi.danceapp.ui.components.FolderCard
import dev.mimi.danceapp.ui.components.VideoCard
import dev.mimi.danceapp.ui.theme.Pink400
import dev.mimi.danceapp.ui.theme.PinkLight
import kotlinx.coroutines.launch

@Composable
fun SearchScreen(
    onVideoClick: (Int) -> Unit,
    onFolderClick: (Int) -> Unit
) {
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<SearchResult>>(emptyList()) }
    var searching by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) { focusRequester.requestFocus() }

    fun doSearch(q: String) {
        if (q.isBlank()) return
        scope.launch {
            searching = true
            try {
                results = Repository.search(q).items
            } catch (_: Exception) { }
            searching = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PinkLight)
            .padding(horizontal = 48.dp, vertical = 24.dp)
    ) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            placeholder = { Text("Search videos and folders…") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { doSearch(query) }),
            shape = RoundedCornerShape(24.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Pink400,
                unfocusedBorderColor = Color(0xFFe9d5ff)
            ),
            modifier = Modifier
                .fillMaxWidth()
                .focusRequester(focusRequester)
        )

        Spacer(Modifier.height(24.dp))

        when {
            searching -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Searching…", color = Pink400, fontSize = 18.sp)
            }
            results.isEmpty() && query.isNotBlank() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No results for \"$query\"", color = Color(0xFF9ca3af), fontSize = 16.sp)
            }
            results.isNotEmpty() -> LazyVerticalGrid(
                columns = GridCells.Adaptive(minSize = 200.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(results) { item ->
                    if (item.kind == "video") {
                        VideoCard(
                            id = item.id,
                            title = item.title,
                            durationSec = item.durationSec,
                            hasThumb = item.hasThumb ?: false,
                            position = item.position ?: 0.0,
                            watched = item.watched ?: false,
                            onClick = { onVideoClick(item.id) }
                        )
                    } else {
                        FolderCard(
                            id = item.id,
                            name = item.title,
                            childCount = 0,
                            thumbVideoIds = emptyList(),
                            onClick = { onFolderClick(item.id) }
                        )
                    }
                }
            }
        }
    }
}
