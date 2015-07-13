/// <reference path='../../typings/jquery/jquery.d.ts'/>
/// <reference path='../../typings/knockout/knockout.d.ts'/>
/// <reference path='../../typings/gmaps/google.maps.d.ts'/>
var app = app || {};

(function () {
    'use strict';

    // KNOCKOUT VIEWS //

    var SpeciesModel = function (species) {
        this.species = ko.observable(species.binomial);
        this.keywords = species.keywords.toLowerCase();
        this.isVisible = ko.observable(false);
        this.sightings = species.sightings;
        this.drawMapMarker = function () {
            var map;
            this.isVisible() ? map = app.map.map : map = null;
            for (var i = 0, len = this.sightings.length; i < len; i++) {
                this.sightings[i].marker.setMap(map);
            }
        };
        this.taxon = function () {
            if (species.wm) {
                var arr = [];
                var taxon = species.wm.taxon;
                for (var key in taxon) {
                    arr.push(key + ': ' + taxon[key]);
                }
                return arr.join(' | ');
            } else {
                return ''; // failing silently
            }
        }.bind(this)();
        this.commonNames = (species.wm) ? 'Also known as: ' +
            species.wm.commonNames.join(', ') + '.' : '' ;
    };

    var ViewModel = function (data) {

        this.speciesNames = [];

        // observable array of all species
        this.species = ko.observableArray(function (species) {
            species = species || data.species;
            var arr = [];
            for (var key in species) {
                arr.push(new SpeciesModel(species[key]));
                this.speciesNames.push(species[key].binomial);
            }
            return arr;
        }.bind(this)());

        // text string to filter species
        this.filterStr = ko.observable('');
        this.tempFilterStr = '';

        this.filteredSpecies = ko.computed(function () {
            return this.species().filter(function (species) {
                species.isVisible(
                    species.keywords.indexOf(this.filterStr().toLowerCase()) >= 0
                );
                return species.isVisible();
            }.bind(this));
        }.bind(this));

        this.photos = ko.observableArray();

        // Events //

        this.listClick = function (species) {
            this.toggleFilterStr(species.species());
        }.bind(this);

        this.mapMarkerBounce = function (species) {
            var sightings = species.sightings;
            for (var i = 0, len = sightings.length; i < len; i++) {
                sightings[i].marker.setAnimation(google.maps.Animation.BOUNCE);
            }
        };
        this.mapMarkerPuncture = function (species) {
            var sightings = species.sightings;
            for (var i = 0, len = sightings.length; i < len; i++) {
                sightings[i].marker.setAnimation(null);
            }
        };

        // Helper Functions //

        this.toggleFilterStr = function (str) {
            if (this.filterStr() === str) {
                this.filterStr(this.tempFilterStr);
            } else {
                this.tempFilterStr = this.filterStr();
                this.filterStr(str);
            }
        };
    };

    // MAPS VIEW //
    
    app.map = {
        options: {
            center: { lat: -33.844, lng: 151.112 },
            zoom: 17,
            mapTypeId: google.maps.MapTypeId.TERRAIN,
            disableDefaultUI: true
        },

        toggleInfoWindow: function (species, marker) {
            var currentContent = infowindow.getContent();
            var newContent = app.data.species[species].wm ?
                app.data.species[species].wm.iwHTML : species;
            // let the user toggle the InfoWindow
            if (currentContent !== newContent) {
                // there is only one infowindow, so set content with each click
                infowindow.setContent(newContent);
                infowindow.open(this.map, marker);
            } else if (currentContent === newContent &&
                app.data.currentSighting.marker === marker) {
                $('#addNew').fadeIn();
                // clear content with close to enable toggle logic
                infowindow.setContent('');
                infowindow.close();
            } else {
                // moving same content to a new marker
                infowindow.close();
                infowindow.open(this.map, marker);
            }
        }
    };

    var infowindow = new google.maps.InfoWindow({ content: '' });

    // add listener to InfoWindow close button to clear content too
    google.maps.event.addListener(infowindow, 'closeclick', function () {
        $('#addNew').fadeIn();
        infowindow.setContent('');
        app.viewModel.photos(null); // fix this
        app.data.currentSighting.deselect(true);
        app.data.currentSighting = '';
    });

    app.newEntryInfoWindow = null;
    app.newEntryMarker = null;
    app.lastEntryMarker = null;

    app.undoLastEntry = function () {
        $('#messages').fadeOut();
        app.lastEntryMarker.setMap(null);
        app.viewModel.species().pop();
        delete app.data.species[app.viewModel.speciesNames.pop()];
    };

    app.saveNewSighting = function () {
        var name = $('#newName')[0].value;
        if (name.length < 3) {
            alert('That doesn\'t appear to be a valid name.');
            return;
        } else {
            name = name[0].toUpperCase() + name.slice(1).toLowerCase();
        }

        var location = app.newEntryMarker.getPosition();
        var newEntry = {
            'name': name,
            'lat': location.A,
            'lng': location.F,
            'date': new Date()
        };
        var speciesIndex = app.viewModel.speciesNames.indexOf(name);

        var callback = function () {
            // If we don't already have that species
            if (speciesIndex === -1) {
                // Add it to the knockout VM and save a reference for undo
                app.viewModel.species().push(new SpeciesModel(app.data.species[name]));
                app.viewModel.speciesNames.push(name);
                app.lastEntryMarker = app.data.species[name].sightings[0].marker;
                // if the title provided is not a valid species
                if (app.data.species[name].wm === undefined ||
                app.data.species[name].wm.taxon.kingdom === 'unknown') {
                    alert(name === 'Homo sapiens' ? name + ' considered harmful.':
                        'Unable to find that species on Wikipedia. \n' +
                        'If you spelled it correctly, then my Wikiparser ' +
                        'has let you down, sorry :(');
                    app.viewModel.species().pop();
                    delete app.data.species[app.viewModel.speciesNames.pop()];
                    return;
                }
            } else {
                // just set the marker icons
                var icons = app.data.species[name].sightings[0].marker.icons;
                var sighting = app.data.species[name].sightings.pop();
                sighting.marker.icons.unselected = icons.unselected;
                sighting.marker.icons.selected = icons.selected;
                sighting.marker.setIcon(icons.unselected);
                app.data.species[name].sightings.push(sighting);
                app.lastEntryMarker = sighting.marker;
            }
            $('.dialog').find('em').text(name);
            $('#messages').fadeIn();
            setTimeout(function () {$('#messages').fadeOut('slow');}, 5000);
            // forces a list refresh
            app.viewModel.filterStr('//');
            app.viewModel.filterStr('');
        };

        if (speciesIndex === -1) {
            app.data.addNewSpecies(newEntry, callback);
            app.data.addNewSighting(newEntry);
        } else {
            app.data.addNewSighting(newEntry, callback);
        }

        app.newEntryInfoWindow.setContent('');
        app.newEntryMarker.setMap(null);
        $('#saveNew').fadeOut();
        $('#addNew').fadeIn('slow');
    };

    app.newSighting = function () {
        $('#addNew').fadeOut();
        $('#saveNew').fadeIn('slow');
        if (app.data.currentSighting) {
            app.data.currentSighting.deselect();
            infowindow.close();
        }
        this.map.map.panTo(this.map.options.center);
        app.newEntryMarker = new google.maps.Marker({
            position: this.map.options.center,
            map: app.map.map,
            draggable: true,
            icon: 'images/sblank.png',
            title: 'Drag me!'
        });

        // Render the InfoWindow
        app.newEntryInfoWindow = new google.maps.InfoWindow();
        app.newEntryInfoWindow.setContent($('#newSightingInfoWindow').html());
        app.newEntryInfoWindow.open(this.map.map, app.newEntryMarker);

        // add listener to InfoWindow abort new Entry function
        google.maps.event.addListener(app.newEntryInfoWindow, 'closeclick', function () {
            $('#saveNew').fadeOut();
            $('#addNew').fadeIn('slow');
            app.newEntryInfoWindow.close();
            app.newEntryMarker.setMap(null);
            return;
        });

        // add listener to InfoWindow input to save new Entry with Enter key (13)
        $('#newName').keyup(function (e) {
            e.which === 13 && app.saveNewSighting();
        });

    };

    // initialize google map
    var initializeGmap = function () {
        app.map.map = new google.maps.Map(document.getElementById('map-canvas'),
            app.map.options);
    };
    google.maps.event.addDomListener(window, 'load', initializeGmap);

    // initialize knockout js
    window.onload = function () {
        app.viewModel = new ViewModel(app.data);
        ko.applyBindings(app.viewModel);
    };

})();