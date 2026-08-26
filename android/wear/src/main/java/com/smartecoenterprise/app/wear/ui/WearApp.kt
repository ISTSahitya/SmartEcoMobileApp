package com.smartecoenterprise.app.wear.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.navArgument
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController
import com.smartecoenterprise.app.wear.di.ServiceLocator
import com.smartecoenterprise.app.wear.ui.common.LoadingScreen
import com.smartecoenterprise.app.wear.ui.login.LoginScreen
import com.smartecoenterprise.app.wear.ui.login.LoginViewModel
import com.smartecoenterprise.app.wear.ui.overview.OverviewScreen
import com.smartecoenterprise.app.wear.ui.overview.OverviewViewModel
import com.smartecoenterprise.app.wear.ui.roomdetail.RoomDetailScreen
import com.smartecoenterprise.app.wear.ui.roomdetail.RoomDetailViewModel
import com.smartecoenterprise.app.wear.ui.rooms.RoomListScreen
import com.smartecoenterprise.app.wear.ui.rooms.RoomListViewModel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

object Destinations {
    const val LOGIN = "login"
    const val OVERVIEW = "overview"
    const val ROOMS = "rooms"
    const val ROOM_DETAIL = "room/{roomId}"
    const val ARG_ROOM_ID = "roomId"

    fun roomDetail(roomId: Int) = "room/$roomId"
}

@Composable
fun WearApp() {
    val authRepository = remember { ServiceLocator.authRepository }

    // The session is read (and decrypted) off disk asynchronously, and
    // SwipeDismissableNavHost reads startDestination exactly once. Rendering the
    // graph before the answer is known would strand a signed-in user on the
    // login screen, so hold a spinner until this resolves. null = still loading.
    val startsSignedIn by produceState<Boolean?>(initialValue = null) {
        value = authRepository.session.first() != null
    }

    when (startsSignedIn) {
        null -> LoadingScreen()
        else -> NavGraph(startAtOverview = startsSignedIn == true)
    }
}

@Composable
private fun NavGraph(startAtOverview: Boolean) {
    val navController = rememberSwipeDismissableNavController()
    val authRepository = remember { ServiceLocator.authRepository }
    val scope = rememberCoroutineScope()

    // Any 401 outside login clears the session and lands here. popUpTo(0) wipes
    // the back stack so a swipe-back cannot return to a screen with no token
    // behind it.
    LaunchedEffect(Unit) {
        authRepository.sessionExpired.collect {
            navController.navigate(Destinations.LOGIN) {
                popUpTo(0) { inclusive = true }
            }
        }
    }

    SwipeDismissableNavHost(
        navController = navController,
        startDestination = if (startAtOverview) Destinations.OVERVIEW else Destinations.LOGIN,
    ) {
        composable(Destinations.LOGIN) {
            val viewModel: LoginViewModel = viewModel(factory = ViewModelFactories.login)
            LoginScreen(
                viewModel = viewModel,
                onSignedIn = {
                    navController.navigate(Destinations.OVERVIEW) {
                        popUpTo(0) { inclusive = true }
                    }
                },
            )
        }

        composable(Destinations.OVERVIEW) {
            val viewModel: OverviewViewModel = viewModel(factory = ViewModelFactories.overview)
            OverviewScreen(
                viewModel = viewModel,
                onRoomClick = { navController.navigate(Destinations.roomDetail(it)) },
                onAllRoomsClick = { navController.navigate(Destinations.ROOMS) },
                onSignOut = {
                    scope.launch {
                        // Drop cached readings too, or the next user would briefly
                        // see the previous tenant's rooms.
                        ServiceLocator.airQualityRepository.invalidate()
                        authRepository.logout()
                        navController.navigate(Destinations.LOGIN) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                },
            )
        }

        composable(Destinations.ROOMS) {
            val viewModel: RoomListViewModel = viewModel(factory = ViewModelFactories.roomList)
            RoomListScreen(
                viewModel = viewModel,
                onRoomClick = { navController.navigate(Destinations.roomDetail(it)) },
            )
        }

        composable(
            route = Destinations.ROOM_DETAIL,
            arguments = listOf(navArgument(Destinations.ARG_ROOM_ID) { type = NavType.IntType }),
        ) { entry ->
            val roomId = entry.arguments?.getInt(Destinations.ARG_ROOM_ID)
            if (roomId == null) {
                LoadingScreen()
            } else {
                val viewModel: RoomDetailViewModel = viewModel(
                    // Keyed, or navigating room -> room would reuse the first
                    // room's ViewModel and show its readings.
                    key = "room-$roomId",
                    factory = ViewModelFactories.roomDetail(roomId),
                )
                RoomDetailScreen(viewModel = viewModel)
            }
        }
    }
}
