
import { Dimensions, Platform, StyleSheet } from "react-native"

const { width } = Dimensions.get('window');
const isIphone = Platform.OS === 'ios' && width < 768;
const isIosTablet = Platform.OS === 'ios' && width >= 768;
 

export default InitialScreensStyles = StyleSheet.create({
    container : {
        flex: 1,
    },

    safeArea: {
        flex: 1,
        alignItems: 'center',
        justifyContent: isIphone || isIosTablet ? 'flex-start' : 'space-between',
        paddingTop: isIphone ? 64 : isIosTablet ? 110 : 80,
        paddingBottom: isIosTablet ? 70 : 0,
    },

    header: {
        marginHorizontal: 20,
        marginBottom: isIphone ? 8 : isIosTablet ? 32 : 18
    },

    carouselSection: {
        flex: isIosTablet ? 0 : 1,
        height: isIosTablet ? 640 : undefined,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },

    footer: {
        width: '100%',
        minHeight: isIphone ? 220 : isIosTablet ? 84 : 96,
        justifyContent: isIphone ? 'flex-start' : 'center',
        paddingTop: isIphone ? 22 : isIosTablet ? 10 : 0,
        paddingBottom: isIphone ? 72 : 0,
    },
    
    pageHeading: {
        fontFamily: 'DM Sans',   
        fontWeight: '300',
        fontSize: 24,
        textAlign: 'center',
        color : '#363636',
        marginBottom: 10,
    },

    pageDescription: {
        fontWeight: '400',
        fontSize: 14,
        fontFamily: 'DM Sans',   
        textAlign: 'center',
        color : '#4C5C68'
    },

    buttonContainer: {
        width: '100%',
        maxWidth: isIosTablet ? 680 : undefined,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: isIosTablet ? 0 : 30,
    },

    nextButton: {
        width: 124,
        height: 54,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    
    nextButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        lineHeight: 20,
        textAlign: 'center',
    },

    skipButton: {
        fontWeight: '300',
        fontSize: 16,
        textAlign: 'center',
        textDecorationLine: 'underline',
        textDecorationStyle: 'solid',
    }
})
