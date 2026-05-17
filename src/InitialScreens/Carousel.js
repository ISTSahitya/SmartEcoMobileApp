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
const shortestSide = Math.min(width, height);
const isPhone = shortestSide < 600;
const isIosTablet = Platform.OS === 'ios' && shortestSide >= 600;
const imageWidth = isPhone
    ? Math.min(width * 0.86, 360)
    : isIosTablet
        ? Math.min(width * 0.58, 560)
        : Math.min(width * 0.82, 420);
const imageHeight = isPhone
    ? Math.min(height * 0.34, imageWidth * 1.25)
    : isIosTablet
        ? Math.min(height * 0.46, imageWidth * 1.14)
        : Math.min(360, imageWidth * 1.2);
const carouselHeight = imageHeight + (isPhone ? 48 : 66);

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
    }, [currentScreen])


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
            <Image source={item.imageSrc} alt={item.image} style={styles.image} resizeMode="contain" />
        </Animated.View>
    )
}

const Pagination = ({ paginationIndex }) => {
    return (
        <View style={styles.paginationContainer}>
            {carouselItems.map((_, index) => (
                <View
                    style={[
                        styles.paginationDot,
                        paginationIndex === index ? styles.activeDot : styles.inactiveDot,
                    ]}
                    key={index}
                />
            ))}
        </View>
    )
}

const styles = StyleSheet.create({

    mainContainer: {
        width: '100%',
        height: carouselHeight,
        gap: isPhone ? 10 : 18,
    },

    itemContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: width,
    },

    image: {
        width: imageWidth,
        height: imageHeight,
    },

    paginationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isPhone ? 4 : 8,
    },

    paginationDot: {
        height: isPhone ? 14 : 16,
        width: isPhone ? 14 : 16,
        borderRadius: 8,
    },

    activeDot: {
        backgroundColor: '#217C70',
    },

    inactiveDot: {
        backgroundColor: '#C4DBD8',
    }
})

export default Carousel
