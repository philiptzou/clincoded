'use strict';
var React = require('react');
var url = require('url');
var _ = require('underscore');
var moment = require('moment');
var panel = require('../libs/bootstrap/panel');
var form = require('../libs/bootstrap/form');
var globals = require('./globals');
var curator = require('./curator');
var RestMixin = require('./rest').RestMixin;
var methods = require('./methods');

var CurationMixin = curator.CurationMixin;
var CurationPalette = curator.CurationPalette;
var PanelGroup = panel.PanelGroup;
var Panel = panel.Panel;
var Form = form.Form;
var FormMixin = form.FormMixin;
var Input = form.Input;
var InputMixin = form.InputMixin;
var queryKeyValue = globals.queryKeyValue;
var userMatch = globals.userMatch;

var ProvisionalCuration = React.createClass({
    mixins: [FormMixin, RestMixin, CurationMixin],

    contextTypes: {
        navigate: React.PropTypes.func
    },

    queryValues: {},

    getInitialState: function() {
        return {
            url: '',
            user: '',
            gdm: {},
            testObj: {},
            testStr: '',
            testList: [],
            assessed_patho: [], // list of variant uuid
            assessed_seg: [], // list of family uuid
            assessed_exp: [], // list of evidence_type of experimental
            finalExperimentalScore: 0
        };
    },

    in_array: function(item, array) {
        for(var i in array){
            if (array[i] == item) {
                return true;
            }
        }
        return false;
    },

    loadData: function() {
        var gdmUuid = queryKeyValue('gdm', this.props.href);
        var user = this.props.session.user_properties.uuid;

        var uris = _.compact([
            '/gdm/' + gdmUuid, // search for entire data set of the gdm
            '/assessments/' // search for all assessments from db
        ]);
        this.getRestDatas(
            uris
        ).then(datas => {
            var stateObj = {};
            stateObj.user = user;
            stateObj.url = uris[0];

            var assessments_all = [];
            datas.forEach(function(data) {
                switch(data['@type'][0]) {
                    case 'gdm':
                        stateObj.gdm = data;
                        break;
                    case 'assessment_collection':
                        assessments_all = data['@graph'];
                        break;
                    default:
                        break;
                }
            });

            // collect segregation, pathogenicity and experimental assessed as Supports by the user
            var pathoList = [], segList = [], expList = [];
            for (var i=0; i<assessments_all.length; i++) {
                var value = assessments_all[i]['value'];
                var owner = assessments_all[i]['submitted_by']['uuid'];
                var gdm = assessments_all[i]['evidence_gdm'];
                var evid_type = assessments_all[i]['evidence_type'];
                var evid_id = assessments_all[i]['evidence_id'];

                if (gdm == stateObj.gdm.uuid && owner == user && value == 'Supports') {
                    if (evid_type == 'Pathogenicity') {
                        pathoList[pathoList.length] = evid_id;
                    }
                    else if (evid_type == 'Segregation') {
                        segList[segList.length] = evid_id;
                    }
                    else {
                        expList[expList.length] = evid_type;
                    }
                }
            }
            stateObj.assessed_patho = pathoList;
            stateObj.assessed_seg = segList;
            stateObj.assessed_exp = expList;

            // Calculate experimental score
            var scores = [0, 0, 0];
            for (var i in expList) {
                if (expList[i] == 'Expression' || expList[i] == 'Protein interactions' || expList[i] == 'Biochemical function') {
                    scores[0] += 0.5;
                }
                else if (expList[i] == 'Rescue' || expList[i] == 'Model systems') {
                    scores[1] += 2;
                }
                else if (expList[i] == 'Functional alteration of gene or gene product') {
                    scores[2]++;
                }
            }
            stateObj.testList = scores;
            var temp = 0;
            for (var i in scores) {
                var max = 2;
                if (i == 2) {
                    max = 4;
                }
                temp += (scores[i] <= max) ? scores[i] : max;
            }
            stateObj.finalExperimentalScore = temp;
            this.setState(stateObj);

            return Promise.resolve();
        }).catch(function(e) {
            console.log('OBJECT LOAD ERROR: %s — %s', e.statusText, e.url);
        });
    },

    componentDidMount: function() {
        this.loadData();
    },

    render: function() {
        var gdm = this.state.gdm;

        return (
            <div className="container">
                <h1>Summary and Provisional Classification</h1>
                <h3>user: {this.state.user}</h3>
                <h3>url: {this.state.url}</h3>
                <h3>db gdm id: {this.state.gdm.uuid}</h3>
                <h3>test Object: {Object.keys(this.state.testObj)}</h3>
                <h3>test String: {this.state.testStr}</h3>
                <h3># patho: {this.state.assessed_patho.length}</h3>
                <h3># seg: {this.state.assessed_seg.length}</h3>
                <h3># exp: {this.state.assessed_exp.length}</h3>
                <h3>score 0: {this.state.testList[0]}</h3>
                <h3>score 1: {this.state.testList[1]}</h3>
                <h3>score 2: {this.state.testList[2]}</h3>
                <h3>Final Exp. Score: {this.state.finalExperimentalScore}</h3>
            </div>
        );
    }

});

globals.curator_page.register(ProvisionalCuration,  'curator_page', 'provisional-curation');
