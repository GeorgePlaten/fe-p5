/// <reference path="../../typings/jquery/jquery.d.ts"/>
/// <reference path="../../typings/gmaps/google.maps.d.ts"/>
var app = app || {
    data: {
        species: {},
        currentSighting: null
    }
};

(function () {
    'use strict';

    // Static 'starter' psuedodata to simulate a collection built by user input
    app.data.basic = [
        {
            name: 'Erithacus rubecula',
            lat: -33.844263,
            lng: 151.113756,
            date: new Date('October 13, 2013')
        },
        {
            name: 'Erithacus rubecula',
            lat: -33.843263,
            lng: 151.111756,
            date: new Date('September 14, 2014')
        },
        {
            name: 'Fuchsia magellanica',
            lat: -33.844548,
            lng: 151.110811,
            date: new Date('October 1, 2015')
        },
        {
            name: 'Polyommatus icarus',
            lat: -33.845096,
            lng: 151.113337,
            date: new Date('September 13, 2014')
        },
        {
            name: 'Geranium robertianum',
            lat: -33.844717,
            lng: 151.110467,
            date: new Date('September 13, 2013')
        },
        {
            name: 'Arenaria interpres',
            lat: -33.844948,
            lng: 151.111011,
            date: new Date('January 1, 2012')
        },
        {
            name: 'Marchantia polymorpha',
            lat: -33.845343,
            lng: 151.110789,
            date: new Date('January 2, 2014')
        }
    ];

    var customIcons = {
        'unknown': 'images/blank.png',
        'plants': 'images/plant.png',
        'plants-s': 'images/splant.png',
        'fishes': 'images/fish.png',
        'fishes-s': 'images/sfish.png',
        'animals': 'images/blank.png',
        'animals-s': 'images/sblank.png',
        'mammals': 'images/animal.png',
        'mammals-s': 'images/sanimal.png',
        'flowering plants': 'images/flower.png',
        'flowering plants-s': 'images/sflower.png',
        'insects': 'images/insect.png',
        'insects-s': 'images/sinsect.png',
        'butterflies and moths': 'images/butterfly.png',
        'butterflies and moths-s': 'images/sbutterfly.png',
        'birds': 'images/bird.png',
        'birds-s': 'images/sbird.png',
        'carnivores': 'images/carnivore.png',
        'carnivores-s': 'images/scarnivore.png',
        'crustaceans': 'images/crustacean.png',
        'crustaceans-s': 'images/scrustacean.png',
        'rodents': 'images/rodent.png',
        'rodents-s': 'images/srodent.png',
        'newUserMarker': 'images/sblank.png'
    };

    // MODELS //

    var Species = function (data) {
        this.binomial = data.name;
        this.keywords = data.name;
        this.sightings = [];
    };

    Species.prototype.addKeyword = function (str) {
        this.keywords += ', ' + str.toLowerCase();
    };

    var Sighting = function (data) {
        this.name = data.name;
        var markerOptions = {
            position: new google.maps.LatLng(data.lat, data.lng),
            title: data.name + ', ' + data.date.toDateString(),
            icon: customIcons.unknown,
            icons: {
                selected: customIcons.newUserMarker,
                unselected: customIcons.unknown
            },
            map: null
        };
        this.marker = new google.maps.Marker(markerOptions);
        google.maps.event.addListener(this.marker, 'click', this.selection.bind(this));
    };

    Sighting.prototype.selection = function () {
        app.map.toggleInfoWindow(this.name, this.marker);
        app.data.currentSighting === this ? this.deselect(true) : this.select();
    };

    Sighting.prototype.deselect = function (recenter) {
        app.data.currentSighting = '';
        recenter && app.map.map.panTo(app.map.options.center);
        this.marker.getIcon() && this.marker.setIcon(this.marker.icons.unselected);
        app.viewModel.photos(null);
    };

    Sighting.prototype.select = function () {
        $('#add-new').fadeOut();
        app.data.currentSighting && app.data.currentSighting.deselect();
        app.data.currentSighting = this;
        this.marker.getIcon() && this.marker.setIcon(this.marker.icons.selected);
        app.viewModel.photos(app.data.species[this.name].pics);
    };

    // BUILD THE DATA //

    app.data.addNewSpecies = function (data, callback) {
        var newSpecies = new Species(data);
        var species = newSpecies.binomial;
        if (!app.data.species[species]) {
            app.data.species[species] = newSpecies;
        }
        if (callback) {
            doFlickrRequest(species);
            getWikimediaData(species, callback);
        }
    };

    app.data.addNewSighting = function (data, callback) {
        var newSighting = new Sighting(data);
        var species = newSighting.name;
        app.data.species[species] && app.data.species[species].sightings.push(newSighting);
        callback && callback();
    };

    var initSpecies = function () {
        var basic = app.data.basic;
        for (var i = 0, len = basic.length; i < len; i++) {
            app.data.addNewSpecies(basic[i]);
            app.data.addNewSighting(basic[i]);
        }
    };

    // AJAX //

    var parseWikiTaxoProp = function (text, prop) {
        if (text.indexOf(prop) === -1) {
            return 'Property "' + prop + '" not found';
        } else {
            var str = text.substring(text.indexOf(prop) + prop.length).replace(/ /g, '');
            return str.substring(str.indexOf('=') + 1, str.indexOf('\u000A'));
        }
    };

    var getTaxon = function (text) {
        var taxon = {};
        switch (parseWikiTaxoProp(text, 'regnum')) {
            case '[[Plant]]ae':
                taxon.kingdom = 'plants';
                switch (parseWikiTaxoProp(text, 'unranked_divisio')) {
                    case '[[Angiosperms]]':
                        taxon.division = 'flowering plants';
                        break;
                    default: break;
                }
                break;
            case '[[Animal]]ia':
                taxon.kingdom = 'animals';
                switch (parseWikiTaxoProp(text, 'classis')) {
                    case '[[Insect]]a':
                        taxon.class = 'insects';
                        switch (parseWikiTaxoProp(text, 'ordo')) {
                            case '[[Lepidoptera]]':
                                taxon.order = 'butterflies and moths';
                                break;
                            default: break;
                        }
                        break;
                    case '[[bird|Aves]]':
                    case '[[Aves]]':
                        taxon.class = 'birds';
                        break;
                    case '[[Malacostraca]]':
                        taxon.class = 'crustaceans'; // not true
                        break;
                    case '[[Actinopterygii]]':
                        taxon.class = 'fishes'; // not true
                        break;
                    case '[[Mammal]]ia':
                        taxon.class = 'mammals';
                        switch (parseWikiTaxoProp(text, 'ordo')) {
                            case '[[Rodent]]ia':
                                taxon.order = 'rodents';
                                break;
                            case '[[Carnivora]]':
                                taxon.order = 'carnivores';
                                break;
                            default: break;
                        }
                        break;
                    default: break;
                }
                break;
            default:
                taxon.kingdom = 'unknown';
                break;
        }
        return taxon;
    };

    var processWikimediaData = function (data) {
        var collection = data.query.pages;
        var redirects = data.query.redirects || null;
        var bTagStripper = function (html) {
            return html.replace(/<\/?b>/g, '').toLowerCase();
        };
        for (var page in collection) {
            if (page === '-1') {
                return;
            }
            // ensure exact name matching with original data and
            // Wikipedia enhanced data
            var species = collection[page].title;
            if (redirects) {
                for (var i = 0, len = redirects.length; i < len; i++) {
                    if (species === redirects[i].to) {
                        species = redirects[i].from;
                    }
                }
            }

            var text = collection[page].revisions[0]['*'];
            // console.log(text); // use this when troubleshooting wikiparsing
            var extract = collection[page].extract;
            var url = collection[page].canonicalurl;
            var $infoWindowHTML = $('<div>')
                .append($('<h3>').text(species))
                .append($('<div>').html(extract).addClass('extract'))
                .append($('<p>')
                    .append($('<a>').attr('href', url).text('[Wikipedia]')));
            var taxon = getTaxon(text);

            // code from http://stackoverflow.com/a/11592042
            var commonNames = extract.match(/<b>(.*?)<\/b>/g).map(bTagStripper);

            var current = app.data.species[species];
            current.wm = {
                'iwHTML': $infoWindowHTML[0],
                'url': url,
                'taxon': taxon,
                'commonNames': commonNames
            };
            for (var key in taxon) {
                current.addKeyword(taxon[key]);
            }
            for (var j = 0, jlen = commonNames.length; j < jlen; j++) {
                current.addKeyword(commonNames[j]);
            }
            var sightings = current.sightings;
            var marker;
            var taxoIcon = (taxon.order || taxon.class || taxon.division || taxon.kingdom);
            for (var k = 0, klen = sightings.length; k < klen; k++) {
                marker = sightings[k].marker;
                marker.icons.selected = customIcons[taxoIcon + '-s'];
                marker.icons.unselected = customIcons[taxoIcon];
                marker.setIcon(customIcons[taxoIcon]);
            }
        }
    };

    // Wikimedia prefer to have multiple queries batched into a single request
    var getWikimediaData = function (species, callback) {
        var baseUrl = 'https://en.wikipedia.org//w/api.php?action=query&format=json' +
            '&redirects=&prop=revisions|extracts|info&rvprop=content&rvsection=0' +
            '&exlimit=max&exintro=&excontinue=true&inprop=url';
        // if species parameter is given, put it in an array
        var sightingNames = species ? [species] :
            // else if no parameter given,
            // put all sightings from app.data.basic in the array
            app.data.basic.map(function (sighting) { return sighting.name; });
        var pages = sightingNames.join('|'); // Wikimedia batch format
        $.ajax({
            url: baseUrl + '&titles=' + pages,
            dataType: 'jsonp',
            success: function (data) {
                $('#add-new').prop('disabled', false).addClass('mdl-button--accent');
                $('#read-only').hide();
                processWikimediaData(data);
                callback && callback();
            },
            error: function () {
                $('#add-new').prop('disabled', true).removeClass('mdl-button--accent');
                $('#read-only').show();
            }
        });
    };

    var processFlickrData = function (flickrJSON) {
        var flickrPhotos = flickrJSON.photos.photo;
        var photos = [];
        var fPhoto;
        for (var i = 0, len = flickrPhotos.length; i < len; i++) {
            var photo = {};
            fPhoto = flickrPhotos[i];
            photo.src = fPhoto.url_q;
            photo.title = (fPhoto.title || 'untitled');
            photo.url = 'https://www.flickr.com/photos/' +
            fPhoto.owner + '/' + fPhoto.id;
            photos.push(photo);
        }
        return photos;
    };

    // flickr only allows one request per search term
    // (using temp API key from API explorer)
    var doFlickrRequest = function (name) {
        var url = 'https://api.flickr.com/services/rest/?method=flickr.photos.search' +
            '&api_key=' + app.apikeys.FLICKR + '&safe_search=1&content_type=1' +
            '&extras=url_q&per_page=6&page=1&format=json&nojsoncallback=1';
        $.ajax({
            url: url + '&text=' + name,
            dataType: 'json',
            success: function (data) {
                if (app.data.species[name]) {
                    app.data.species[name].pics = processFlickrData(data);
                }
            }
        });
    };

    // do all Flickr requests
    var getFlickrData = function () {
        var names = app.data.basic.map(
            function (sighting) { return sighting.name; }
            );
        for (var i = 0, len = names.length; i < len; i++) {
            doFlickrRequest(names[i]);
        }
    };

    var init = function () {
        initSpecies();
        getWikimediaData();
        getFlickrData();
    };

    init();

})();