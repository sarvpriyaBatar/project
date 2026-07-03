
    const map = new mapboxgl.Map({
        accessToken: mapToken,
        container: 'map', // container ID
        center: coordinates, // starting position [lng, lat]. Note that lat must be set between -90 and 90
        zoom: 9 // starting zoom
    });

    const marker = new mapboxgl.Marker()
        .setLngLat(coordinates)
        .addTo(map);

