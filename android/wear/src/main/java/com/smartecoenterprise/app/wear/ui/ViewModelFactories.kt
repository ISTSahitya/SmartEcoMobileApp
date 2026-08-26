package com.smartecoenterprise.app.wear.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.smartecoenterprise.app.wear.di.ServiceLocator
import com.smartecoenterprise.app.wear.ui.login.LoginViewModel
import com.smartecoenterprise.app.wear.ui.overview.OverviewViewModel
import com.smartecoenterprise.app.wear.ui.roomdetail.RoomDetailViewModel
import com.smartecoenterprise.app.wear.ui.rooms.RoomListViewModel

/**
 * ViewModel factories reading from [ServiceLocator].
 *
 * Explicit factories rather than a DI framework — see the note on ServiceLocator.
 */
object ViewModelFactories {

    val login = factory { LoginViewModel(ServiceLocator.authRepository) }

    val overview = factory { OverviewViewModel(ServiceLocator.airQualityRepository) }

    val roomList = factory { RoomListViewModel(ServiceLocator.airQualityRepository) }

    fun roomDetail(roomId: Int) = factory {
        RoomDetailViewModel(ServiceLocator.airQualityRepository, roomId)
    }

    // `builder`, not `create`: naming it `create` would shadow against the
    // `create(modelClass)` override below and read as a recursive call.
    private inline fun <reified T : ViewModel> factory(
        crossinline builder: () -> T,
    ) = object : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <M : ViewModel> create(modelClass: Class<M>): M = builder() as M
    }
}
