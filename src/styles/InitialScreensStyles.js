
import { Dimensions, Platform, StyleSheet } from "react-native"

const { width, height } = Dimensions.get('window');
const shortestSide = Math.min(width, height);
const isPhone = shortestSide < 600;
const isIosTablet = Platform.OS === 'ios' && shortestSide >= 600;
const horizontalPadding = isPhone ? 30 : 64;

const InitialScreensStyles = StyleSheet.create({
    container : {
        flex: 1,
    },

    safeArea: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: isPhone ? Math.min(64, height * 0.07) : isIosTablet ? 88 : 80,
        paddingBottom: isPhone ? 32 : isIosTablet ? 58 : 28,
    },

    header: {
        width: '100%',
        maxWidth: isIosTablet ? 720 : 390,
        paddingHorizontal: 20,
        marginBottom: isPhone ? 8 : 26,
    },

    carouselSection: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: isPhone ? 320 : 460,
    },

    footer: {
        width: '100%',
        justifyContent: 'center',
        paddingTop: isPhone ? 18 : 22,
    },
    
    pageHeading: {
        fontFamily: 'DM Sans',   
        fontWeight: '300',
        fontSize: isPhone ? 24 : 34,
        textAlign: 'center',
        color : '#363636',
        marginBottom: isPhone ? 10 : 14,
    },

    pageDescription: {
        fontWeight: '400',
        fontSize: isPhone ? 14 : 20,
        lineHeight: isPhone ? 20 : 28,
        fontFamily: 'DM Sans',   
        textAlign: 'center',
        color : '#4C5C68'
    },

    buttonContainer: {
        width: '100%',
        maxWidth: isIosTablet ? 680 : 460,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: isIosTablet ? 0 : horizontalPadding,
    },

    nextButton: {
        width: isPhone ? 124 : 172,
        height: isPhone ? 54 : 62,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    
    nextButtonText: {
        color: '#fff',
        fontSize: isPhone ? 16 : 20,
        fontWeight: '700',
        lineHeight: isPhone ? 20 : 24,
        textAlign: 'center',
    },

    skipButton: {
        fontWeight: '300',
        fontSize: isPhone ? 16 : 20,
        textAlign: 'center',
        textDecorationLine: 'underline',
        textDecorationStyle: 'solid',
    }
})

export default InitialScreensStyles
