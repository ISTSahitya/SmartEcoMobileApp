import React, { useEffect, useRef, useState } from 'react'
import { View, Image, StyleSheet, Dimensions, Platform } from 'react-native'
import FirstImage from '../assets/images/CarouselImage1.png';
import SecondImage from '../assets/images/CarouselImage2.png';
import ThirdImage from '../assets/images/CarouselImage3.png';
import FourthImage from '../assets/images/CarouselImage4.png';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

const carouselItems = [
    { id: 1, image: 'First Image', imageSrc: FirstImage },
    { id: 2, image: 'Second Image', imageSrc: SecondImage },
    { id: 3, image: 'Third Image', imageSrc: ThirdImage },
    { id: 4, image: 'Fourth Image', imageSrc: FourthImage }
]

const { width, height } = Dimensions.get('window');
const isIphone = Platform.OS === 'ios' && width < 768;
const isIosTablet = Platform.OS === 'ios' && width >= 768;
const imageHeight = isIphone
    ? Math.min(300, Math.max(220, height * 0.34))
    : isIosTablet
        ? Math.min(520, Math.max(440, height * 0.36))
        : 335;
const carouselHeight = isIphone
    ? Math.min(360, Math.max(270, height * 0.42))
    : isIosTablet
        ? imageHeight + 58
        : 400;

function Carousel({ currentScreen }) {
    const scrollX = useSharedValue(0);
    const flatListRef = useRef(null);
    const [data, setData] = useState(carouselItems);
    const [paginationIndex, setPaginationIndex] = useState(0);

    const handleScrollHandler = useAnimatedScrollHandler({
        onScroll: (e) => {
            scrollX.value = e.contentOffset.x;
        }
    });

    const onViewableItemsChanged = ({ viewableItems }) => {
        if (viewableItems.length > 0 && viewableItems[0].index != null) {
            setPaginationIndex(viewableItems[0].index % carouselItems.length);
        }
    };

    useEffect(() => {
        flatListRef?.current?.scrollToIndex({
            index: currentScreen,
            animated: true,
        });

        setPaginationIndex(currentScreen)
    }, [])


    /* ------------------ AUTOPLAY ------------------ */
    // useEffect(() => {
    //     let index = 0;
    //     const interval = setInterval(() => {
    //         
    //         flatListRef.current?.scrollToOffset({
    //             offset: index * width,
    //             animated: true,
    //         });

    //         setPaginationIndex(index % carouselItems.length);
    //         index++;
    //     }, 3000);

    //     return () => clearInterval(interval);
    // }, []);

    return (
        <View style={styles.mainContainer}>
            <Animated.FlatList
                ref={flatListRef}
                removeClippedSubviews={false}
                data={data}
                renderItem={({ item, index }) => <SlideItem item={item} index={index} scrollX={scrollX} />}
                keyExtractor={(_, index) => index.toString()}
                horizontal
                scrollEventThrottle={16}
                showsHorizontalScrollIndicator={false}
                pagingEnabled
                getItemLayout={(_, index)=>({
                    index,
                    length: width,
                    offset: width * index
                })}
                onScroll={handleScrollHandler}
                decelerationRate={'fast'}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                onEndReached={() => setData([...data, ...carouselItems])}
                onEndReachedThreshold={0.5}
            />
            <Pagination paginationIndex={paginationIndex} />
        </View>
    )
}


const SlideItem = ({ item, index, scrollX }) => {

    const AnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    translateX: interpolate(
                        scrollX.value,
                        [(index - 1) * width, index * width, (index + 1) * width],
                        [(-width) * 0.4, 0, width * 0.4],
                        Extrapolation.CLAMP
                    )
                },
                {
                    scale: interpolate(
                        scrollX.value,
                        [(index - 1) * width, index * width, (index + 1) * width],
                        [0.75, 1, 0.75],
                        Extrapolation.CLAMP
                    )
                }
            ]
        }
    })

    return (
        <Animated.View key={index} style={[AnimatedStyle, styles.itemContainer]} >
            <Image source={item.imageSrc} alt={item.image} style={{ height: imageHeight }} resizeMode="contain" />
        </Animated.View>
    )
}

const Pagination = ({ paginationIndex }) => {
    return (
        <View style={styles.paginationContainer}>
            {carouselItems.map((_, index) => (
                <View style={[styles.paginationDot, { backgroundColor: paginationIndex == index ? "#217C70" : "#C4DBD8" }]} key={index} ></View>
            ))}
        </View>
    )
}

const styles = StyleSheet.create({

    mainContainer: {
        height: carouselHeight,
        gap: 10
    },

    itemContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        width: width,
    },

    paginationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4
    },

    paginationDot: {
        height: 14,
        width: 14,
        borderRadius: '100%',
    }
})

export default Carousel
