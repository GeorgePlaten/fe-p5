/// <reference path='../../typings/jquery/jquery.d.ts'/>
/// <reference path='../../typings/knockout/knockout.d.ts'/>
/// <reference path='../../typings/gmaps/google.maps.d.ts'/>

/**
 * @fileoverview Define and manage the application data models
 * @author georgeplaten.github.io
 * @version 0.1.1
 */

(function () {
    'use strict';

    /**
     * Application data storage and management
     * @namespace
     * @memberof app
     */
    app.data = {

        /**
         * The main database with Sightings in native format
         * @field {object}
         * @memberof app.data
         */
        species: {},

        /**
         * Static 'starter' psuedodata to simulate a collection built by user input
         * @field {object[]}
         * @memberof app.data
         */
        basic: [
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
        ],

        /**
         * Add a new Species to the model
         * @method
         * @param {object} data - Sighting object in app.data.basic format
         * @param {function} [callback] - The callback to run after an ajax call
         */
        addNewSpecies: function (data, callback) {
            // Instantiate a new Species
            var newSpecies = new Species(data);
            // get the binomial of the new species
            var species = newSpecies.binomial;
            // If the species is not already in the model
            if (!app.data.species[species]) {
                // then add it to the model
                app.data.species[species] = newSpecies;
            }
            // If there was a callback
            if (callback) {
                // run ajax to get the enhanced data
                // and send the callback through to getWikimediaData
                flickrRequest(species);
                getWikimediaData(species, callback);
            }
        },

        /**
         * Add a new Sighting to a Species
         * @method
         * @param {object} data - Sighting object in app.data.basic format
         * @param {function} [callback] - The callback to run after an ajax call
         */
        addNewSighting: function (data, callback) {
            // Instantiate a new Sighting
            var newSighting = new Sighting(data);
            // Get the species name
            var species = newSighting.name;
            // if the species is already in the data model, add the new sighting
            app.data.species[species] && app.data.species[species].sightings.push(newSighting);
            // if there was a callback function, execute it
            callback && callback();
        }
    };

    /**
     * Collection of custom icon identifiers with filenames
     * @member {object}
     * @global
     */
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
    
    /**
     * Preload icon images in case of dropped connectivity -
     * enables selection state change.
     */
     (function preloadIcons () {
         var image;
         for (var key in customIcons) {
             image = new Image();
             image.src = customIcons[key];
             app.images.push(image);
         }
     })();

    // MODELS //

    /**
     * @class Defines a Species in the application's native format
     * @param {object} data - An object from app.data.basic or app.saveNewSighting()
     * @property {string} binomial - The Species name in binomial format
     * @property {string} keywords - keywords related to the species (for searching)
     * @property {string[]} sightings - Each sighting includes the name and a google
     * map marker object with location, date and custom icons.
     * @memberof global
     */
    var Species = function (data) {
        this.binomial = data.name;
        this.keywords = data.name;
        this.sightings = [];
    };

    /**
     * @param {string} str - A term to append to the keywords string
     */
    Species.prototype.addKeyword = function (str) {
        this.keywords += ', ' + str.toLowerCase();
    };

    /**
     * @class Defines a Sighting in the application's native format
     * @param {object} data - An object from app.data.basic or app.saveNewSighting()
     * @property {string} name - Sighting name (same as species binomial)
     * @property {object} markerOptions - Settings for creating the marker
     * @property {Marker} marker - The Sighting's google.map.Marker object
     * @memberof global
     */
    var Sighting = function (data) {
        this.name = data.name;
        /**
         * @typedef {object}
         * @property {LatLng} position - Location in google maps format
         * @property {string} title - The Marker's tooltip
         * @property {string} icon - The current icon path/file
         * @property {object} icons - The species's custom icons paths/files
         * @property {Map} map - The google map to display the marker on
         */
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
        /**
         * Add a click listener to each marker, parameters are google.maps format
         * @param {Marker} marker - Set to this marker.
         * @param {string} listenerType - google maps event listener
         * @param {object} function - Do this when clicked.
         */
        google.maps.event.addListener(this.marker, 'click', this.selection.bind(this));
    };

    /**
     * Toggle current Sighting selection and infowindow with a marker click
     */
    Sighting.prototype.selection = function () {
        app.gMapVM.toggleInfoWindow(this.name, this.marker);
        app.currentSighting === this ? this.deselect(true) : this.select();
    };

    /**
     * Deselect the Sighting
     * @param {boolean} recenter - Recenter the map?
     */
    Sighting.prototype.deselect = function (recenter) {
        // Clear the current sighting
        app.currentSighting = '';
        // recenter the map if recenter === true
        recenter && app.gMapVM.map.panTo(app.gMapVM.mapOptions.center);
        // if the marker has a custom icon, set it to the unselected version
        this.marker.getIcon() && this.marker.setIcon(this.marker.icons.unselected);
        // clear the photos from KO view model and re-hide the container
        app.koViewModel.photos(null);
        $('.photo-bar').addClass('display-none');
    };

    /**
     * Select the Sighting
     */
    Sighting.prototype.select = function () {
        // Clear add new button from UI to focus on the selection
        $('#add-new').fadeOut();
        // If there is already a Sighting selected, deselect it
        app.currentSighting && app.currentSighting.deselect();
        // Set this sighting to the current sighting
        app.currentSighting = this;
        // if the sighting has a custom marker, set it to the selected version
        this.marker.getIcon() && this.marker.setIcon(this.marker.icons.selected);
        // Populate the KO view model photos with the species pictures and show
        app.koViewModel.photos(app.data.species[this.name].pics);
        $('.photo-bar').removeClass('display-none');
    };


    // AJAX //

    /**
     * Get taxonomic name from Wikimedia text. Called by {@link getTaxon}
     * @param {string} text - the Wikimedia text to search
     * @param {string} prop - the property to search for
     * @returns {string} The name or error message
     * @global
     */
    var parseWikiTaxoProp = function (text, prop) {
        if (text.indexOf(prop) === -1) {
            return 'Property "' + prop + '" not found';
        } else {
            // Trim all text before the prop name
            var str = text.substring(text.indexOf(prop) + prop.length).replace(/ /g, '');
            // Trim text up to and including '=' and after the end of the line
            // and return it the trimmed string
            return str.substring(str.indexOf('=') + 1, str.indexOf('\u000A'));
        }
    };

    /**
     * Build and object of taxonomic classifications from Wikimedia text.
     * Called by {@link processWikiMediaData}
     * @param {string} text - the Wikimedia text to search
     * @returns {object} The object of taxonomic classifications
     * @global
     */
    var getTaxon = function (text) {
        // set up an empty taxon object
        var taxon = {};
        // Search the Wikimedia text for each taxonomic property
        switch (parseWikiTaxoProp(text, 'regnum')) {
            // if found
            case '[[Plant]]ae':
            // add the key and value to the taxon object
            taxon.kingdom = 'plants';
            // and keep going, looking for more properties
            switch (parseWikiTaxoProp(text, 'unranked_divisio')) {
                case '[[Angiosperms]]':
                // adding them if found
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
        // return the taxon object with keys and values as added
        return taxon;
    };

    /**
     * Wrangle data received from Wikimedia. Handles batched requests by looping
     * through each result and adding the enhanced data to app.data.species. Handles
     * redirects by assuming the user would prefer to use their own species title.
     * Called by {@link getWikimediaData} on $.ajax success.
     * @param {JSON} data - the Wikimedia response
     * @global
     */
    var processWikimediaData = function (data) {
        // set a reference to the Wikipedia JSON pages object
        var collection = data.query.pages;
        // set a reference for redirects, default is null if there were none
        var redirects = data.query.redirects || null;
        /**
         * @function
         * @param {string} html - an html fragment with some 'b' tags
         * @returns {string} The string with the 'b' tags removed
         */
        var bTagStripper = function (html) {
            return html.replace(/<\/?b>/g, '').toLowerCase();
        };

        // Process each page received
        for (var page in collection) {
            if (page === '-1') {
                // Wikimedia returns -1 if no pages were found
                return; // abort
            }

            // When adding a new sighting, the name as entered by the user
            // may find a match on Wikipedia, but be redirected to a page
            // with a different title.

            // Assume the user would prefer to use the name they entered
            // rather than the Wikipedia redirect title.

            // Set the species name to the result's page title
            var species = collection[page].title;
            // if there was a redirect
            if (redirects) {
                for (var i = 0, len = redirects.length; i < len; i++) {
                    // loop through the redirects until a match is found
                    if (species === redirects[i].to) {
                        // change it back to user's original title
                        species = redirects[i].from;
                    }
                }
            }

            // Get the Wikimedia text blob (this is in their own markup format)
            var text = collection[page].revisions[0]['*'];
            // console.log(text); // use this when troubleshooting wikiparsing

            // Get the extract and the canonical url
            var extract = collection[page].extract;
            var url = collection[page].canonicalurl;

            // Build a html element for the infowindow with the Wikimedia elements
            var $infoWindowHTML = $('<div>')
                .append($('<h3>').text(species))
                .append($('<div>').html(extract).addClass('extract'))
                .append($('<p>')
                    .append($('<a>').attr('href', url).text('[Wikipedia]')));

            // Build the taxon object
            var taxon = getTaxon(text);

            // Get the common names (in bold tags) from the extract
            // code from http://stackoverflow.com/a/11592042
            var commonNames = extract.match(/<b>(.*?)<\/b>/g).map(bTagStripper);

            // Get a reference to the current species
            var current = app.data.species[species];

            // Build and add a Wikimedia object
            current.wm = {
                'iwHTML': $infoWindowHTML[0],
                'url': url,
                'taxon': taxon,
                'commonNames': commonNames
            };

            // Add keywords from the taxon object
            for (var key in taxon) {
                current.addKeyword(taxon[key]);
            }

            // Add keywords from the common names array
            for (var j = 0, jlen = commonNames.length; j < jlen; j++) {
                current.addKeyword(commonNames[j]);
            }

            // Get a reference to the current species's sightings array
            var sightings = current.sightings;

            // Get the lowest classification found for the species
            // (the options are ordered from least likely to most likely)
            var taxoIcon = (taxon.order || taxon.class || taxon.division || taxon.kingdom);

            // Create a marker variable for the following loop
            var marker;
            // and loop through each sighting of the species, setting the marker icons
            for (var k = 0, klen = sightings.length; k < klen; k++) {
                marker = sightings[k].marker;
                marker.icons.selected = customIcons[taxoIcon + '-s'];
                marker.icons.unselected = customIcons[taxoIcon];
                marker.setIcon(customIcons[taxoIcon]);
            }
        }
    };

    /**
     * Make an API call to Wikimedia and handle success and failure. Note:
     * Wikimedia prefer to have multiple queries batched into a single request.
     * Called by {@link app.data.addNewSpecies} and {@link init}
     * @param {string|string[]} species - The species name(s) to look up
     * @param {func} [callback] - A callback for new user entries
     * @global
     */
    var getWikimediaData = function (species, callback) {
        // Set up the url fragments for the ajax request
        var baseUrl = 'https://en.wikipedia.org//w/api.php?action=query&format=json' +
            '&redirects=&prop=revisions|extracts|info&rvprop=content&rvsection=0' +
            '&exlimit=max&exintro=&excontinue=true&inprop=url';
        // if species parameter is given, put it in an array
        var sightingNames = species ? [species] :
            // else if no parameter given,
            // put all sightings from app.data.basic in the array
            app.data.basic.map(function (sighting) { return sighting.name; });

        var pages = sightingNames.join('|'); // Wikimedia batch format

        // Do the API ajax call with jQuery
        $.ajax({
            url: baseUrl + '&titles=' + pages,
            dataType: 'jsonp',
            // On success,
            success: function (data) {
                // Reset to UI and update status indicators to show Wikimedia is available
                $('#add-new').prop('disabled', false).addClass('mdl-button--accent');
                $('.wikipedia-fail').hide();
                $('.wikipedia-ok').show();
                $('.ajax-status').removeClass('read-only');
                // Process the data and if there's a callback, execute it.
                processWikimediaData(data);
                callback && callback();
            },
            // On error,
            error: function () {
                // Update the UI to indicate Wikipedia is unavailable and disable the
                // 'add' button (as species names can't be verified without Wikipedia)
                $('#add-new').prop('disabled', true).removeClass('mdl-button--accent');
                $('.wikipedia-ok').hide();
                $('.wikipedia-fail').show();
                $('.ajax-status').addClass('read-only');
            }
        });
    };

    /**
     * @typedef {object} Photo
     * @property {string} src - url to image thumbnail
     * @property {string} title='untitled' - image title, if supplied
     * @property {string} url - link back to author's original location
     * @global
     */

    /**
     * Process the data received from Flickr. Build an array of Photo objects
     * Called by {@link flickrRequest}.
     * @param {JSON} data - The Flickr data object in JSON format
     * @returns {Photo[]}
     * @global
     */
    var processFlickrData = function (data) {
        var flickrPhotos = data.photos.photo;
        var photos = [];
        var fPhoto;
        var img;
        for (var i = 0, len = flickrPhotos.length; i < len; i++) {
            // Build a Photo object
            var photo = {};
            fPhoto = flickrPhotos[i];
            photo.src = fPhoto.url_q; // thumbnail
            photo.title = (fPhoto.title || 'untitled');
            photo.url = 'https://www.flickr.com/photos/' +
            fPhoto.owner + '/' + fPhoto.id;
            // Add it to the array
            photos.push(photo);
            // Preload the thumbnail to app.images
            img = new Image();
            img.src = fPhoto.url_q;
            app.images.push(img)
        }
        // return the array to flickrRequest()
        return photos;
    };

    /**
     * Make an API call to Flickr. On success, add an array of photos to
     * the species. On failure, fail (almost) silently as the photos are
     * considered non-critical progressive enhancement. Note: unlike Wikimedia,
     * Flickr do not have a facility to batch multiple queries in a single request.
     * Called by {@link app.data.addNewSpecies} and {@link initBatchFlickrRequests}
     * @param {string} name - The Flickr API search term, a species name
     * @global
     */
    var flickrRequest = function (name) {
        // Prepare the request url fragments
        var url = 'https://api.flickr.com/services/rest/?method=flickr.photos.search' +
            '&api_key=' + app.apikeys.FLICKR + '&safe_search=1&content_type=1' +
            '&extras=url_q&per_page=6&page=1&format=json&nojsoncallback=1';
        // Use jQuery to perform the ajax call
        $.ajax({
            // Build and set the request URL
            url: url + '&text=' + name,
            dataType: 'json',
            // On success,
            success: function (data) {
                // Update UI elements to show Flickr connection is available
                $('.flickr-fail').hide();
                $('.flickr-ok').show();
                $('.ajax-status').removeClass('flickr-failed');
                // Get the photo array and set it as a property of the species
                if (app.data.species[name]) {
                    app.data.species[name].pics = processFlickrData(data);
                }
            },
            error: function () {
                // flickr data is considered a non-critical enhancement.
                // Give minimal distraction to the user, update the UI
                // info tooltip to confirm failure if photos are missed.
                $('.flickr-ok').hide();
                $('.flickr-fail').show();
                $('.ajax-status').addClass('flickr-failed');
            }
        });
    };

    /**
     * Batch and process the Flickr requests for the initial set of sightings
     * in app.data.basic. The results are added to app.data.species by
     * {@link flickrRequest}
     * @global
     */
    var initBatchFlickrRequests = function () {
        var names = app.data.basic.map(
            function (sighting) { return sighting.name; }
            );
        for (var i = 0, len = names.length; i < len; i++) {
            flickrRequest(names[i]);
        }
    };

    /**
     * Initialize the sample set of species and sightings. Process the data from
     * app.data.basic and add it to app.data.species. Enhance the data with info
     * from Wikimedia and Flickr, if available.
     * @global
     */
    var init = function () {
        var basic = app.data.basic;
        // loop through each sighting in app.data.basic
        for (var i = 0, len = basic.length; i < len; i++) {
            // Add the species and sighting
            app.data.addNewSpecies(basic[i]);
            app.data.addNewSighting(basic[i]);
        }
        // Enhance all species with Wikimedia information
        getWikimediaData();
        // Enhance all species with photo from Flickr
        initBatchFlickrRequests();
    };

    init(); // start here

})();