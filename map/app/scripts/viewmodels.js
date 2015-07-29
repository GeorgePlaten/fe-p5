/* global app */
/// <reference path='../../typings/jquery/jquery.d.ts'/>
/// <reference path='../../typings/knockout/knockout.d.ts'/>
/// <reference path='../../typings/gmaps/google.maps.d.ts'/>

/**
 * @fileoverview Define and manage the Knockout.js and Google Maps View Models
 * @author georgeplaten.github.io
 * @version 0.1.1
 */

(function () {
    'use strict';

    /**
     * GOOGLE MAPS view model data and operations
     * @namespace
     */
    app.gMapVM = {
        /**
         * @typedef {object}
         * @property {object} center - map center location
         * @property {number} zoom - Zoom level. See: https://goo.gl/vhVALD
         * @property {string} mapTypeId - List of constants https://goo.gl/lEkZX
         * @property {boolean} disableDefaultUI - Turns off some map controls
         */
        mapOptions: {
            center: { lat: -33.844, lng: 151.112 },
            zoom: 17,
            mapTypeId: google.maps.MapTypeId.TERRAIN,
            disableDefaultUI: true
        },

        /** The infowindow to display at markers */
        infowindow: new google.maps.InfoWindow({ content: '' }),

        /**
         * Show and hide the infowindow. Also handles the infowindow content
         * management. Called by Sighting.select() and Sighting.deselect()
         * @param {string} species - Comes from the Sighting.name
         * @param {Marker} marker - Comes from the Sighting.Marker
         */
        toggleInfoWindow: function (species, marker) {
            // Store any current infowindow content
            var currentContent = this.infowindow.getContent();
            // if the species has Wikipedia data, set it as the infowindow
            // content, otherwise set it to the species name string.
            var newContent = app.data.species[species].wm ?
                app.data.species[species].wm.iwHTML : species;

            // let the user toggle the InfoWindow
            // If the content is changing
            if (currentContent !== newContent) {
                // change it and move it to the new marker
                this.infowindow.setContent(newContent);
                this.infowindow.open(this.map, marker);

            // if the content is not changing and the marker is not changing
            // then the user has clicked is toggling the infowindow off
            } else if (currentContent === newContent &&
                app.currentSighting.marker === marker) {
                $('#add-new').fadeIn();
                // also clear content to enable toggle logic
                this.infowindow.setContent('');
                this.infowindow.close();

            // the content is not changing but the marker is
            } else {
                // moving same content to a new marker
                this.infowindow.close();
                this.infowindow.open(this.map, marker);
            }
        },

        /** The Google map object */
        map: null,

        /** The infowindow for new user entries */
        newEntryInfoWindow: null,

        /** The Marker for new user entries */
        newEntryMarker: null,

        /** The last entry marker, for undo */
        lastEntryMarker: null
    };


    /**
     * Simulates a marker deselect.
     * Clear the google maps infowindow, reset the default UI, clear the photos array,
     * deselect the marker and clear the currentSighting.
     * Attached to the google map infowindow close button click event.
     * @global
     */
    var onCloseClick = function () {
        $('#add-new').fadeIn();
        app.gMapVM.infowindow.setContent('');
        app.koViewModel.photos(null);
        app.currentSighting.deselect(true);
        app.currentSighting = '';
    };
    google.maps.event.addListener(app.gMapVM.infowindow, 'closeclick', onCloseClick);

    /**
     * Initialize the Google map.
     * @global
     */
    var initGmap = function () {
        app.gMapVM.map = new google.maps.Map(document.getElementById('map-canvas'),
            app.gMapVM.mapOptions);
    };
    google.maps.event.addDomListener(window, 'load', initGmap);


    // KNOCKOUT //

    /**
     * @class Defines a Knockout model of a Species
     * @param {object} species - A Species from {@link app.data.species}
     * @property {string} binomial - The species name in binomial form.
     * @property {string} keywords - Keywords relating to the species.
     *   (not rendered, used for filtering)
     * @property {string} commonNames - Sentence form of common names
     * @property {string} taxon - Sentence fragment form of taxonomial classifications
     * @property {ko.observable(boolean)} isVisible - Is this species visible?
     * @property {Sighting[]} sightings - From app.data.Species.Sighting, each
     *   contains a google.maps.Marker
     * @memberof global
     */
    var KoSpecies = function (species) {
        
        // Intentionally avoiding the standard practice use of 'var self = this;' here.
        // Style copied from:
        // https://github.com/tastejs/todomvc/blob/gh-pages/examples/knockoutjs/js/app.js
        // And kept here to help me develop of a better understanding of context.
        this.binomial = species.binomial;
        this.keywords = species.keywords.toLowerCase();
        this.commonNames = (species.wm) ? 'Also known as: ' +
            species.wm.commonNames.join(', ') + '.' : '' ;
        this.taxon = function () {
            if (species.wm) {
                var arr = [];
                var taxon = species.wm.taxon;
                for (var key in taxon) {
                    arr.push(key + ': ' + taxon[key]);
                }
                return arr.join(' | ');
            } else {
                return ''; // fail silently
            }
        }.bind(this)();
        this.isVisible = ko.observable(false);
        this.sightings = species.sightings;
        /**
         * Toggles all sighting map markers according to the isVisible property
         * using google.maps.Marker.setMap(). Used by Viewmodel.filteredSpecies().
         */
        this.drawMapMarker = function () {
            var map;
            this.isVisible() ? map = app.gMapVM.map : map = null;
            for (var i = 0, len = this.sightings.length; i < len; i++) {
                this.sightings[i].marker.setMap(map);
            }
        };
    };

    /**
     * @class Defines the Knockout View Model
     * @param {object} data - Everything from {@link app.data}
     * @property {ko.observable(string)} filterStr - String used to match and
     *   filter in this.filteredSpecies
     * @property {string} tempFilterStr - Placeholder used by this.listClick()
     * @property {string[]} speciesNames - Shortlist of species names, used when adding,
     *   checking and undoing new sightings and species.
     * @property {ko.observableArray(Photo[])} photos - Placeholder for photos.
     *   Values set by google.map.Marker click events: Sightings.select() and
     *   Sightings.deselect()
     * @property {ko.observableArray(KoSpecies[])} allSpecies - All of the species
     *   in the Knockout Viewmodel
     * @property {ko.computed(KoSpecies[])} filteredSpecies - The items that populate
     *   the list view. Filtered version of this.allSpecies (using filterStr)
     * @memberof global
     */
    var KoViewModel = function (data) {
        this.filterStr = ko.observable('');
        this.tempFilterStr = '';
        this.speciesNames = [];
        this.photos = ko.observableArray();
        this.allSpecies = ko.observableArray(function () {
            var species = data.species;
            var arr = [];
            for (var key in species) {
                arr.push(new KoSpecies(species[key]));
                this.speciesNames.push(species[key].binomial);
            }
            return arr;
        }.bind(this)());
        this.filteredSpecies = ko.computed(function () {
            return this.allSpecies().filter(function (koSpecies) {
                koSpecies.isVisible(
                    koSpecies.keywords.indexOf(this.filterStr().toLowerCase()) >= 0
                );
                return koSpecies.isVisible();
            }.bind(this));
        }.bind(this));

        /**
         * Save any current string in the filter input when a list entry is clicked.
         * Re-enters the string if the filter is cleared by a second click.
         * @param {KoSpecies} koSpecies Species object from list item's KO click listener.
         * @method
         */
        this.listClick = function (koSpecies) {
            if (this.filterStr() === koSpecies.binomial) {
                this.filterStr(this.tempFilterStr);
            } else {
                this.tempFilterStr = this.filterStr();
                this.filterStr(koSpecies.binomial);
            }
        }.bind(this);

        /**
         * Animate all species's sightings map markers
         * @param {KoSpecies} koSpecies Species object from list item's KO mouseover listener.
         */
        this.mapMarkerBounce = function (koSpecies) {
            var sightings = koSpecies.sightings;
            for (var i = 0, len = sightings.length; i < len; i++) {
                sightings[i].marker.setAnimation(google.maps.Animation.BOUNCE);
            }
        };
        /**
         * Stop animation of all species's sightings map markers
         * @param {KoSpecies} koSpecies Species object from list item's KO mouseout listener.
         */
        this.mapMarkerPuncture = function (koSpecies) {
            var sightings = koSpecies.sightings;
            for (var i = 0, len = sightings.length; i < len; i++) {
                sightings[i].marker.setAnimation(null);
            }
        };

        /**
         * Add new koSpecies to app.koViewModel.allSpecies. Called by
         * app.saveNewSighting() if the species has not been recorded before.
         * @param {string} binomial New species name in binomial format.
         * @method
         */
        this.addNewSpecies = function (binomial) {
            this.allSpecies().push(new KoSpecies(data.species[binomial]));
            this.speciesNames.push(binomial);
        }.bind(this);
    };

    /**
     * Initialize the KnockoutJS view model and bindings.
     */
    window.onload = function () {
        app.koViewModel = new KoViewModel(app.data);
        ko.applyBindings(app.koViewModel);
    };

})();