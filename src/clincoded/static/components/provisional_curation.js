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
var RecordHeader = curator.RecordHeader;
var PmidSummary = curator.PmidSummary;
var PmidDoiButtons = curator.PmidDoiButtons;
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
            user: null, // login user uuid
            gdm: null, // must be null initially.
            provisional: null, // must be null initially.
            assessments: null,  //temp test data
            testStr: null, // temp test data
            testList: [], // temp test data
            assessed_patho: [], // list of variant uuid, temp test data
            allFamilies: [], // list of family uuid, temp test data
            familiesCollected: [],
            individualsCollected: [],
            assessed_exp: [], // list of evidence_type of experimental
            finalExperimentalScore: 0,
            publications: [],
            years: '',
            totalScore: {},
            autoClassification: ''
        };
    },

    loadData: function() {
        var gdmUuid = this.queryValues.gdmUuid;
        var rerun = this.queryValues.rerun; //queryKeyValue('rerun', this.props.href);

        // get gdm and all assessments from db.
        var uris = _.compact([
            '/gdm/' + gdmUuid, // search for entire data set of the gdm
            '/assessments/' // search for all assessments from db
        ]);
        this.getRestDatas(
            uris
        ).then(datas => {
            var stateObj = {};
            stateObj.user = this.props.session.user_properties.uuid; //'e49d01a5-51f7-4a32-ba0e-b2a71684e4aa'
            //stateObj.user = 'e49d01a5-51f7-4a32-ba0e-b2a71684e4aa';

            var assessments_all = [];
            datas.forEach(function(data) {
                switch(data['@type'][0]) {
                    case 'gdm':
                        stateObj.gdm = data;
                        break;
                    case 'assessment_collection':
                        stateObj.assessments = data['@graph'];
                        assessments_all = data['@graph'];
                        break;
                    default:
                        break;
                }
            });

            // Update the Curator Mixin OMIM state with the current GDM's OMIM ID.
            if (stateObj.gdm && stateObj.gdm.omimId) {
                this.setOmimIdState(stateObj.gdm.omimId);
            }

            // search for existing provisional
            if (stateObj.gdm.provisionalClassifications && stateObj.gdm.provisionalClassifications.length > 0) {
                for (var i in stateObj.gdm.provisionalClassifications) {
                    var owner = stateObj.gdm.provisionalClassifications[i].submitted_by;
                    if (owner.uuid == stateObj.user) { // find
                        stateObj.provisional = stateObj.gdm.provisionalClassifications[i];
                        break;
                    }
                }
            }

            stateObj.testStr = this.props.href;
            // Calculate scores and assign classification

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
        this.queryValues.gdmUuid = queryKeyValue('gdm', this.props.href);
        var rerun = queryKeyValue('rerun', this.props.href);
        this.queryValues.rerun = rerun;

        var families = count_proband(this.state.familiesCollected);
        var individuals = count_proband(this.state.individualsCollected);
        return (
            <div>
                { this.state.gdm ?
                    <div>
                        <RecordHeader gdm={this.state.gdm} omimId={this.state.currOmimId} updateOmimId={this.updateOmimId} />
                        <div className="container">
                            <h1>Summary And Provisional Classification: </h1>
                                { (this.state.gdm && this.state.provisional) ?
                                    <div>
                                        <Panel width="100%" title="View - Saved Version" open>
                                            <div className="form-group">
                                                <div className="col-sm-5"><strong className="pull-right">Total Score:</strong></div>
                                                <div className="col-sm-7"><span>{this.state.provisional.totalScore}</span></div>
                                            </div>
                                            <div className="form-group">
                                                <div className="col-sm-5">
                                                    <strong className="pull-right">Calcaleted Clinical Validity Classification:</strong
                                                ></div>
                                                <div className="col-sm-7"><span>{this.state.provisional.autoClassification}</span></div>
                                            </div>
                                            <div className="form-group">
                                                <div className="col-sm-5">
                                                    <strong className="pull-right">Change Provisional Clinical Validity Classification:</strong>
                                                </div>
                                                <div className="col-sm-7"><span>{this.state.provisional.alteredClassification}</span></div>
                                            </div>
                                            <div className="form-group">
                                                <div className="col-sm-5"><strong className="pull-right">Explain Reason(s) for Change:</strong></div>
                                                <div className="col-sm-7"><span>{this.state.provisional.reasons}</span></div>
                                                <div><span>&nbsp;</span></div>
                                            </div>
                                            <br />
                                        </Panel>
                                        { (this.state.gdm && rerun !== 'yes') ?
                                            <a href={this.props.href + '&rerun=yes'} title="Click to calculate again"><h4>Calculate Again</h4></a>
                                            : null
                                        }
                                    </div>
                                    : null
                                }
                                { (this.state.gdm && (!this.state.provisional || rerun === 'yes')) ?
                                    <div>
                                        <Form submitHandler={this.submitForm} formClassName="form-horizontal form-std">
                                            <Panel title="Curation - New Calculation" open>
                                                {NewCalculation.call(this)}
                                            </Panel>
                                            <div className="curation-submit clearfix">
                                                <Input type="submit" inputClassName="btn-primary pull-right" id="submit" title="Save" />
                                            </div>
                                        </Form>
                                    </div>
                                    : null
                                }
                            </div>
                        </div>
                    : null
                }
            </div>
        );
    }
});

globals.curator_page.register(ProvisionalCuration,  'curator_page', 'provisional-curation');

var NewCalculation = function() {
    var gdm = this.state.gdm;
    var assessments = this.state.assessments;

    var pathoList = [], expList = [], exp_scores = [0, 0, 0];
    for (var i in assessments) {
        var value = assessments[i]['value'];
        var owner = assessments[i]['submitted_by']['uuid'];
        var gdmAssessed = assessments[i]['evidence_gdm'];
        var evid_type = assessments[i]['evidence_type'];
        var evid_id = assessments[i]['evidence_id'];
        //var user = stateObj.user

        if (gdmAssessed == gdm.uuid && owner == this.state.user && value == 'Supports') {
            if (evid_type == 'Pathogenicity') {
                pathoList.push({"patho":evid_id, "owner":owner, "value":value});
            }
            else if (evid_type == 'Expression' || evid_type == 'Protein interactions' || evid_type == 'Biochemical function') {
                expList.push({ "type": evid_type, "score": 0.5 });
                exp_scores[0] += 0.5;
            }
            else if (evid_type == 'Functional alteration of gene or gene product') {
                expList.push({ "type": evid_type, "score": 1 });
                exp_scores[1] += 1;
            }
            else if (evid_type == 'Rescue' || evid_type == 'Model systems') {
                expList.push({ "type": evid_type, "score": 2 });
                exp_scores[2] += 2;
            }
        }
    }

    // Calculate experimental score
    var finalExperimentalScore = 0;
    for (var i in exp_scores) {
        var max = 2; // set max value for each type
        if (i == 2) {
            max = 4;
        }
        finalExperimentalScore += (exp_scores[i] <= max) ? exp_scores[i] : max; // not more than the max
    }

    // Clinical clinical evidence (# pronband, # publication, # years)
    var gdmPathoList = gdm.variantPathogenicity;
    var variantsList = [];
    var variantIdList = [];
    for (var i in gdmPathoList) {
        var pathoUuid = gdmPathoList[i].uuid;
        var owner = gdmPathoList[i].submitted_by;
        var variant = gdmPathoList[i].variant;
        var varUuid = variant.uuid;

        for (var j in pathoList) {
            if (pathoUuid == pathoList[j].patho) {
                variantsList.push({ "patho": pathoUuid, "variant": varUuid, "assessedBy": pathoList[j].owner, "value": pathoList[j].value });
                variantIdList.push(varUuid);
                break;
            }
        }
    }

    // collect all families and independent individuals in the gdm
    var annotations = gdm.annotations;
    var familiesCollected = [];
    var individualsCollected = [];
    for (var i in annotations) {
        if (annotations[i].groups) {
            var groups = annotations[i].groups;
            for (var j in groups) {
                if (groups[j].familyIncluded) {
                    filter(familiesCollected, groups[j].familyIncluded, annotations[i].article, variantIdList);
                }
                if (groups[j].individualIncluded) {
                    filter(individualsCollected, groups[j].individualIncluded, annotations[i].article, variantIdList);
                }
            }
        }
        if (annotations[i].families) {
            filter(familiesCollected, annotations[i].families, annotations[i].article, variantIdList);
        }
        if (annotations[i].individuals) {
            filter(individualsCollected, annotations[i].individuals, annotations[i].article, variantIdList);
        }
    }

    var articleCollected = [];
    var year = new Date();
    var earliest = year.getFullYear();
    for (var i in familiesCollected) {
        if (!in_array(familiesCollected[i].pmid, articleCollected) && familiesCollected[i].pmid != '') {
            articleCollected.push(familiesCollected[i].pmid);
            earliest = get_earliest_year(earliest, familiesCollected[i].date);
        }
    }

    if (individualsCollected.length > 0) {
        for (var i in individualsCollected) {
            if (!in_array(individualsCollected[i].pmid, articleCollected) && individualsCollected[i].pmid != '') {
                articleCollected.push(individualsCollected[i].pmid);
                earliest = get_earliest_year(earliest, individualsCollected[i].date);
            }
        }
    }

    var currentYear = year.getFullYear();
    var years = (currentYear.valueOf() - earliest.valueOf()) + ' = ' + currentYear + ' - ' + earliest;
    var time = currentYear.valueOf() - earliest.valueOf();
    var timeScore = 0, probandScore = 0, pubScore = 0, expScore = 0;
    if (time >= 3) {
        timeScore = 2;
    }
    else if (time >= 1) {
        timeScore = 1;
    }
    else {
        timeScore = 0;
    }

    var proband = count_proband(familiesCollected) + count_proband(individualsCollected);
    if (proband > 18) {
        probandScore = 7;
    }
    else if (proband >=16) {
        probandScore = 6;
    }
    else if (proband > 12) {
        probandScore = 5;
    }
    else if (proband > 9) {
        probandScore = 4;
    }
    else if (proband > 6) {
        probandScore = 3;
    }
    else if (proband > 3) {
        probandScore = 2;
    }
    else if (proband >= 1) {
        probandScore = 1;
    }
    else {
        probandScore = 0;
    }

    var expScore = 0;
    if (finalExperimentalScore >= 6) {
        expScore = 6;
    }
    else {
        expScore = finalExperimentalScore;
    }

    var pubScore = 0;
    if (articleCollected.length >= 5) {
        pubScore = 5;
    }
    else {
        pubScore = articleCollected.length;
    }

    var totalScore = probandScore + pubScore + timeScore + expScore;
    var autoClassification;
    if (totalScore > 16){
        autoClassification = 'Definitive';
    }
    else if (totalScore > 12) {
        autoClassification = 'Strong';
    }
    else if (totalScore > 9) {
        autoClassification = 'Moderate';
    }
    else {
        autoClassification = 'Limited';
    }

    return (
        <div className="form-group">
            <div className="col-sm-5"><strong className="pull-right">Total Score:</strong></div>
            <div className="col-sm-7"><span>{totalScore}</span></div>
            <div className="col-sm-5"><span className="pull-right">&nbsp;</span></div><div className="col-sm-5"><span>&nbsp;</span></div>
            <div className="col-sm-5">
                <strong className="pull-right">Calcaleted Clinical Validity Classification:</strong>
            </div>
            <div className="col-sm-7"><span>{autoClassification}</span></div>
            <div className="col-sm-5"><span className="pull-right">&nbsp;</span></div><div className="col-sm-5"><span>&nbsp;</span></div>
            <Input type="select" ref="alteredClassification" label="Change Provisional Clinical Validity Classification:" defaultValue="none"
                labelClassName="col-sm-5 control-label" wrapperClassName="col-sm-7" groupClassName="form-group">
                <option value="none">No Selection</option>
                <option disabled="disabled"></option>
                <option value="Definitive">Definitive</option>
                <option value="Strong">Strong</option>
                <option value="Moderate">Moderate</option>
                <option value="Limited">Limited</option>
            </Input>
            <Input type="textarea" ref="reasons" label="Explain Reason(s) for Change:" rows="5" labelClassName="col-sm-5 control-label"
                wrapperClassName="col-sm-7" groupClassName="form-group" />
        </div>
    );
};

//Independent functions
var in_array = function(item, list) {
    for(var i in list){
        if (list[i] == item) {
            return true;
        }
    }
    return false;
};

var get_earliest_year = function(earliest, dateStr) {
    var pattern = new RegExp(/^\d\d\d\d/);
    var theYear = pattern.exec(dateStr);
    if (theYear && theYear.valueOf() < earliest.valueOf()) {
        return theYear;
    }
    return earliest;
};

var filter = function(target, branch, article, variantList) {
    for (var i in branch) {
        var obj = branch[i];
        var variantIds = [];
        var allAssessed = false;
        if (obj['@type'][0] == 'family') {
            if (obj.segregation) {
                var seg = obj.segregation;
                if (seg.variants) {
                    var variants = seg.variants;
                    for (var j in variants) {
                        if (!in_array(variants[j].uuid, variantList)) {
                            allAssessed = false;
                            break;
                        }
                        else {
                            allAssessed = true;
                            variantIds.push(variants[j].uuid);
                        }
                    }
                }
            }
        }
        else if (obj['@type'][0] == 'individual') {
            if (obj.variants) {
                var variants = obj.variants;
                for (var j in variants) {
                    if (in_array(variants[j].uuid, variantList)) {
                        variantIds.push(variants[j].uuid);
                        allAssessed = true;
                    }
                }
            }
        }

        if (allAssessed) {
            target.push({"evidence":branch[i].uuid, "variant":variantIds[0], "pmid":article.pmid, "date": article.date});
            if (variantIds.length > 0) {
                target.push({"evidence":'', "variant":variantIds[1], "pmid":'', "date": ''});
            }
        }
    }
    return target;
};

var count_proband = function(evidenceList) {
    var proband = 0;
    for (var i in evidenceList) {
        if (i === 0 || evidenceList[i].evidence !== '') {
            proband++;
        }
    }
    return proband;
};
