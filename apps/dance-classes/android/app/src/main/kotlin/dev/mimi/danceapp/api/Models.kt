package dev.mimi.danceapp.api

import com.google.gson.annotations.SerializedName

data class FolderItem(
    val id: Int,
    val name: String,
    val childCount: Int,
    val thumbVideoIds: List<Int> = emptyList()
)

data class VideoItem(
    val id: Int,
    val title: String,
    val episodeNum: Int?,
    val filename: String,
    val durationSec: Double?,
    val hasThumb: Boolean,
    val scanStatus: String?,
    val position: Double,
    val watched: Boolean,
    val favorite: Boolean = false
)

data class FolderResponse(
    val folder: FolderDetail,
    val breadcrumb: List<BreadcrumbItem>,
    val folders: List<FolderItem>,
    val videos: List<VideoItem>
)

data class FolderDetail(
    val id: Int,
    val name: String,
    val relPath: String,
    val parentId: Int?
)

data class BreadcrumbItem(val id: Int, val name: String)

data class VideoDetail(
    val id: Int,
    val title: String,
    val filename: String,
    val episodeNum: Int?,
    val durationSec: Double?,
    val sizeBytes: Long?,
    val scanStatus: String?,
    val hasThumb: Boolean,
    val breadcrumb: List<BreadcrumbItem>,
    val siblings: List<VideoItem>,
    val prevId: Int?,
    val nextId: Int?,
    val position: Double,
    val duration: Double?,
    val watched: Boolean,
    val favorite: Boolean
)

data class SearchResult(
    val kind: String,
    val id: Int,
    val title: String,
    val path: String?,
    val snippet: String?,
    val durationSec: Double?,
    val hasThumb: Boolean?,
    val folderId: Int?,
    val position: Double?,
    val watched: Boolean?
)

data class SearchResponse(val items: List<SearchResult>)

data class FavoriteItem(
    val id: Int,
    val title: String,
    val durationSec: Double?,
    val hasThumb: Boolean,
    val folderId: Int,
    val createdAt: String,
    val position: Double,
    val watched: Boolean
)

data class FavoritesResponse(val items: List<FavoriteItem>)

data class ContinueItem(
    val id: Int,
    val title: String,
    val durationSec: Double?,
    val hasThumb: Boolean,
    val folderId: Int,
    val position: Double,
    val progressDuration: Double?,
    val watched: Boolean,
    val updatedAt: String
)

data class ContinueResponse(val items: List<ContinueItem>)

data class ProgressBody(val position: Double, val duration: Double?)
data class WatchedBody(val watched: Boolean)
