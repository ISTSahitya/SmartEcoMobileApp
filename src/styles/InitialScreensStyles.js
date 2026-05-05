import { Platform, StyleSheet } from "react-native"

export default InitialScreensStyles = StyleSheet.create({
    container : {
        flex: 1,
    },

    safeArea: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 30 : 80,
        paddingBottom: Platform.OS === 'ios' ? 20 : 60,
    },

    header: {
        marginHorizontal: 20
    },
    
    pageHeading: {
        fontFamily: 'DM Sans',   
        fontWeight: 300,
        fontSize: 24,
        textAlign: 'center',
        color : '#363636',
        marginBottom: 10,
    },

    pageDescription: {
        fontWeight: 400,
        fontSize: 14,
        fontFamily: 'DM Sans',   
        textAlign: 'center',
        color : '#4C5C68'
    },

    buttonContainer: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 30,
    },

    nextButton: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderRadius: 50
    },
    
    nextButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 700,
    },

    skipButton: {
        fontWeight: 300,
        fontSize: 16,
        textAlign: 'center',
        textDecorationLine: 'underline',
        textDecorationStyle: 'solid',
    }
})