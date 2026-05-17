package dev.mimi.danceapp.api

import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.*

interface DanceApi {

    @GET("api/folders/root")
    suspend fun getRootFolder(): FolderResponse

    @GET("api/folders/{id}")
    suspend fun getFolder(@Path("id") id: Int): FolderResponse

    @GET("api/videos/{id}")
    suspend fun getVideo(@Path("id") id: Int): VideoDetail

    @GET("api/search")
    suspend fun search(@Query("q") q: String, @Query("limit") limit: Int = 50): SearchResponse

    @GET("api/favorites")
    suspend fun getFavorites(): FavoritesResponse

    @POST("api/favorites/{videoId}")
    suspend fun addFavorite(@Path("videoId") videoId: Int): Response<ResponseBody>

    @DELETE("api/favorites/{videoId}")
    suspend fun removeFavorite(@Path("videoId") videoId: Int): Response<ResponseBody>

    @POST("api/videos/{id}/progress")
    suspend fun saveProgress(@Path("id") id: Int, @Body body: ProgressBody): Response<ResponseBody>

    @POST("api/videos/{id}/watched")
    suspend fun setWatched(@Path("id") id: Int, @Body body: WatchedBody): Response<ResponseBody>

    @GET("api/continue")
    suspend fun getContinue(@Query("limit") limit: Int = 20): ContinueResponse
}
