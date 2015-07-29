/**
 * @fileoverview Base level elements and operations.
 * @author georgeplaten.github.io
 * @version 0.1.1
 */

/// <reference path='../../typings/jquery/jquery.d.ts'/>
/// <reference path='../../typings/knockout/knockout.d.ts'/>
/// <reference path='../../typings/gmaps/google.maps.d.ts'/>
/// <reference path='viewmodels.js'/>

/**
 * The application namespace
 * @namespace
 */
var app = app || {};

(function () {
    'use strict';

    /**
     * The currently selected Sighting
     * @field {Sighting}
     * @memberof app
     */
    app.currentSighting = null;

    /**
     * API Keys
     * @field {object}
     * @memberof app
     */
    app.apikeys = {
        FLICKR: 'e9648afe7558db322364fbe75507a46f',
        gmaps: ''
    };
    
     /**
      * Custom icon image paths for preloading
      * @field {string[]}
      * @memberof app
      */
     app.images = [];

    /**
     * Save New Entry.
     * Get the species name entered by visitor and check if species already exists
     * in the application. Get and use the location from google.maps.Marker
     * If species not known, check the name for validity with Wikipedia. Inform
     * visitor of success of failure.
     */
    app.saveNewSighting = function () {
        var name = $('#new-name')[0].value;
        // format the name correctly
        name = name[0].toUpperCase() + name.slice(1).toLowerCase();
        // Check if new species (-1 confirms new)
        var speciesIndex = app.koViewModel.speciesNames.indexOf(name);
        // Get the google.maps formatted location
        var gmLocation = app.gMapVM.newEntryMarker.getPosition();
        // Frame the new entry data
        var newEntry = {
            'name': name,
            'lat': gmLocation.A,
            'lng': gmLocation.F,
            'date': new Date()
        };

        /**
         * Add new entry to data model and view model after all ajax calls are
         * complete. Validate a new species name with Wikipedia. Undo any
         * changes if name invalid. Inform the visitor of success or failure.
         * @memberof app
         * @inner
         */
        var saveNewEntryCallback = function () {
            // If we didn't already have that species
            if (speciesIndex === -1) {
                // Add it to the knockout VM and set lastEntryMarker for undo
                app.koViewModel.addNewSpecies(name);
                app.gMapVM.lastEntryMarker = app.data.species[name].sightings[0].marker;
                // if the title provided is not a valid species
                if (app.data.species[name].wm === undefined ||
                app.data.species[name].wm.taxon.kingdom === 'unknown') {
                    // let the visitor know what went wrong
                    alert(name === 'Homo sapiens' ? name + ' considered harmful.':
                        'Unable to find that species on Wikipedia. \n' +
                        'If you spelled it correctly, then my Wikiparser ' +
                        'has let you down, sorry :(');
                    // and delete from knockout VM and app.data.species
                    app.koViewModel.allSpecies().pop();
                    delete app.data.species[app.koViewModel.speciesNames.pop()];
                    // and abort
                    return;
                }
            } else {
                // else we already had that species so get and set the
                // sighting marker icon (copy it from the last sighting)
                var icon = app.data.species[name].sightings[0].marker.icons.unselected;
                var sighting = app.data.species[name].sightings.pop();
                sighting.marker.setIcon(icon);
                app.data.species[name].sightings.push(sighting);
                // and set the last entry reference to enable undo
                app.gMapVM.lastEntryMarker = sighting.marker;
            }
            // let the visitor know that they have saved a new entry
            // and give them the chance to undo
            $('.message').find('em').text(name);
            $('.undo-dialog').fadeIn();
            setTimeout(function () {$('.undo-dialog').fadeOut('slow');}, 4000);
            // Refresh the list
            app.koViewModel.filterStr('//');
            app.koViewModel.filterStr('');
        };

        // Save the new info to app.data and treat it with saveNewEntryCallback()
        if (speciesIndex === -1) {
            app.data.addNewSpecies(newEntry, saveNewEntryCallback);
            app.data.addNewSighting(newEntry);
        } else {
            app.data.addNewSighting(newEntry, saveNewEntryCallback);
        }

        // clean up the UI afterwards
        app.gMapVM.newEntryInfoWindow.setContent('');
        app.gMapVM.newEntryMarker.setMap(null);
        $('#save-new').fadeOut();
        $('#add-new').fadeIn('slow');
    };

    /**
     * Add New Entry.
     * Prepare the UI. Add a new draggable google.map.Marker.
     * Create and add a new google.maps.Infowindow with input field
     * and attach it to the marker. Set up event listeners for the
     * visitors next action. (Save or Abort)
     */
    app.addNewSighting = function () {
        // UI button switch from 'add' to 'done'
        $('#add-new').fadeOut();
        $('#save-new').fadeIn('slow');
        // De-select any map markers and infowindows
        if (app.currentSighting) {
            app.currentSighting.deselect();
            app.gMapVM.infowindow.close();
        }
        // center the map view
        this.gMapVM.map.panTo(this.gMapVM.mapOptions.center);

        // create and add the new marker
        app.gMapVM.newEntryMarker = new google.maps.Marker({
            position: this.gMapVM.mapOptions.center,
            map: app.gMapVM.map,
            draggable: true,
            icon: 'images/sblank.png',
            title: 'Drag me!'
        });

        // Create, add content and render the new InfoWindow
        app.gMapVM.newEntryInfoWindow = new google.maps.InfoWindow();
        app.gMapVM.newEntryInfoWindow.setContent($('.new-sighting-info-window').html());
        app.gMapVM.newEntryInfoWindow.open(this.gMapVM.map, app.gMapVM.newEntryMarker);

        // add listener to InfoWindow abort new Entry function
        google.maps.event.addListener(app.gMapVM.newEntryInfoWindow, 'closeclick', function () {
            // reset the UI
            $('#save-new').fadeOut();
            $('#add-new').fadeIn('slow');
            app.gMapVM.newEntryInfoWindow.close();
            app.gMapVM.newEntryMarker.setMap(null);
            return;
        });

        // add listener to InfoWindow input to save new Entry with Enter key (13)
        $('#new-name').keyup(function (e) {
            e.which === 13 && app.saveNewSighting();
        });
    };

    /**
     * Undo last successful Add New Entry operation
     */
    app.undoLastEntry = function () {
        $('.undo-dialog').fadeOut();
        app.gMapVM.lastEntryMarker.setMap(null);
        app.koViewModel.allSpecies().pop();
        delete app.data.species[app.koViewModel.speciesNames.pop()];
    };


    // Add a notice if Google maps fails to load in 8 seconds
    setTimeout(function () {
        $('#map-canvas').find('h2').text() && $('#map-canvas').find('h2').text(
            'Unable to reach Google Maps, please try reloading the page');
        }, 8000);

    // UI Button event listeners
    $('#add-new').on({'click': function () {
        app.addNewSighting();
    }});

    $('#save-new').on({'click': function () {
        app.saveNewSighting();
    }});

    $('#message-button').on({'click': function () {
        app.undoLastEntry();
    }});
    
    /**
     * Respond to Connectivity Dropped Event
     * Using Offline.js library from https://github.com/hubspot/offline
     * with default settings.
     */
    Offline.on('confirmed-down', function () {
        
        // Update the UI info mdl-tooltip, update status for both Flickr and Wikipedia
        $('.all-fail').show();
        $('.wikipedia-ok').hide();
        $('.wikipedia-fail').show();
        $('.ajax-status').addClass('read-only');
        $('.flickr-ok').hide();
        $('.flickr-fail').show();
        
        // disable adding new items (Wikipedia can't verify the species name)
        $('#add-new').prop('disabled', true).removeClass('mdl-button--accent');
    });

    
    /**
     * Respond to Connectivity Reopened Event
     * Using Offline.js library from https://github.com/hubspot/offline
     * with default settings.
     */
     Offline.on('confirmed-up', function () {
        
        // Update the UI info mdl-tooltip, update status for both Flickr and Wikipedia
        $('.all-fail').hide();
        $('.wikipedia-fail').hide();
        $('.wikipedia-ok').show();
        $('.ajax-status').removeClass('read-only');
        $('.flickr-fail').hide();
        $('.flickr-ok').show();
        
        // Enable adding new items (Wikipedia can't verify the species name)
        $('#add-new').prop('disabled', false).addClass('mdl-button--accent');
    });

})();
