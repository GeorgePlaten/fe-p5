/// <reference path='../../typings/jquery/jquery.d.ts'/>
/// <reference path='../../typings/knockout/knockout.d.ts'/>
/// <reference path='../../typings/gmaps/google.maps.d.ts'/>
var app = app || {
    data: {
        species: {},
        currentSighting: null
    }
};

(function () {
    'use strict';
    
    app.apikeys = {
        FLICKR: '8cb9b18ff2c7e69d920b7ce056169306',
        gmaps: ''
    };

    // Add a notice if Google maps fails to load in 8 seconds
    setTimeout(function () {
        $('#map-canvas').find('h2').text() && $('#map-canvas').find('h2').text(
            'Unable to reach Google Maps, please try reloading the page');
        }, 8000);

    // UI Buttons
    $('#add-new').on({'click': function () {
        app.newSighting();
    }});
    $('#save-new').on({'click': function () {
        app.saveNewSighting();
    }});
    $('#message-button').on({'click': function () {
        app.undoLastEntry();
    }});

})();
