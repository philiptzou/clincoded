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
            assessed_patho: [], // list of variant uuid, temp item
            allFamilies: [], // list of family uuid, temp item
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

    selectItems: function(family, article) {
        var seg = family.segregation;
        var variants = seg.variants;
        var varUuidList = [];
        for (var i in variants) {
            varUuidList.push(variants[i].uuid);
        }
        return ({
            "uuid": family.uuid,
            "variants": varUuidList,
            "pmid": article.pmid,
            "year": article.date
        });
    },

    loadData: function(userUuid) {
        //var gdmUuid = queryKeyValue('gdm', this.props.href);
        var gdmUuid = this.queryValues.gdmUuid;
        var uris = _.compact([
            '/gdm/' + gdmUuid, // search for entire data set of the gdm
            '/assessments/' // search for all assessments from db
        ]);
        this.getRestDatas(
            uris
        ).then(datas => {
            var stateObj = {};
            stateObj.url = uris[0];
            stateObj.user = 'e49d01a5-51f7-4a32-ba0e-b2a71684e4aa';

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
            var pathoList = [], segList = [], expList = [], exp_scores = [0, 0, 0];
            for (var i=0; i<assessments_all.length; i++) {
                var value = assessments_all[i]['value'];
                var owner = assessments_all[i]['submitted_by']['uuid'];
                var gdm = assessments_all[i]['evidence_gdm'];
                var evid_type = assessments_all[i]['evidence_type'];
                var evid_id = assessments_all[i]['evidence_id'];
                var user = stateObj.user

                if (gdm == stateObj.gdm.uuid && owner == user && value == 'Supports') {
                    if (evid_type == 'Pathogenicity') {
                        pathoList.push({"patho":evid_id, "owner":owner, "value":value});
                    }
                    //else if (evid_type == 'Segregation') {
                    //    segList[segList.length] = evid_id;
                    //}
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

            // 3 temp test lists
            stateObj.assessed_exp = expList;

            // Calculate experimental score
            var temp = 0;
            for (var i in exp_scores) {
                var max = 2; // set max value for each type
                if (i == 2) {
                    max = 4;
                }
                temp += (exp_scores[i] <= max) ? exp_scores[i] : max; // not more than the max
            }
            stateObj.finalExperimentalScore = temp; // final score

            // Clinical evidence (# pronband, # publication, # years)
            var gdmPathoList = stateObj.gdm.variantPathogenicity;
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
            stateObj.assessed_patho = variantsList;

            var annotations = stateObj.gdm.annotations;
            var allFamilies = []; // collect all families in the gdm
            var allIndividuals = [];
            for (var i in annotations) {
                if (annotations[i].groups) {
                    var groups = annotations[i].groups;
                    for (var j in groups) {
                        if (groups[j].familyIncluded) {
                            array_append(allFamilies, groups[j].familyIncluded, annotations[i].article);
                        }
                        if (groups[j].individualIncluded) {
                            array_append(allIndividuals, groups[j].individualIncluded, annotations[i].article);
                        }
                    }
                }
                if (annotations[i].families) {
                    array_append(allFamilies, annotations[i].families, annotations[i].article);
                }
                if (annotations[i].individuals) {
                    array_append(allIndividuals, annotations[i].individuals, annotations[i].article);
                }
            }
            stateObj.allFamilies = allFamilies;

            var articleCollected = [];
            var year = new Date();
            var earliest = year.getFullYear();
            var familiesCollected = [];
            var familyIdPicked = [];
            for (var i in allFamilies) {
                var family = allFamilies[i]['evidenceObj'];
                var article = allFamilies[i]['article'];
                if (family.segregation) {
                    var seg = family.segregation;
                    if (seg.variants) {
                        var variants = seg.variants;
                        for (var j in variants) {
                            if (in_array(variants[j].uuid, variantIdList)) {
                                familiesCollected.push({ "family":family.uuid, "variant":variants[j].uuid, "pmid":article.pmid, "year":article.date });
                                if (!in_array(family.uuid, familyIdPicked)) {
                                    familyIdPicked.push(family.uuid);
                                }
                                if (!in_array(article.pmid, articleCollected)) {
                                    articleCollected.push(article.pmid);
                                    earliest = setEarliestYear(earliest, article.date);
                                }
                            }
                        }
                    }
                }
            }
            stateObj.familiesCollected = familiesCollected;
            stateObj.testStr = familyIdPicked.length + '';

            var individualsCollected = [];
            if (variantIdList.length > 0 && allIndividuals.length >0) {
                var individualIdPicked = [];
                for (var i in allIndividuals) {
                    var individual = allIndividuals[i]['evidenceObj'];
                    var article = allIndividuals[i]['article'];
                    var variants = individual.variants;
                    for (var j in variants) {
                        if (in_array(variants[j].uuid, variantIdList) && !in_array(individual.uuid, individualIdPicked)) {
                            individualsCollected.push({ "individual":individual.uuid, "variant":variants[j].uuid, "pmid":article.pmid, "year":article.date });
                            individualIdPicked.push(individual.uuid);
                            if (!in_array(article.pmid, articleCollected)) {
                                articleCollected.push(article.pmid);
                                earliest = setEarliestYear(earliest, article.date);
                            }
                            break;
                        }
                    }
                }
            }
            stateObj.individualsCollected = individualsCollected;
            stateObj.publications = articleCollected;
            var currentYear = year.getFullYear();
            stateObj.years = (currentYear.valueOf() - earliest.valueOf()) + ' = ' + currentYear + ' - ' + earliest;
            var time = currentYear.valueOf() - earliest.valueOf();
            var timeScore = 0, probandScore = 0, pubScore = 0, expScore = 0;
            if (time > 1 && time <= 3) {
                timeScore = 1;
            }
            else if (time > 3) {
                timeScore = 2;
            }
            else {
                timeScore = 0;
            }
            var proband = stateObj.familiesCollected.length + stateObj.individualsCollected.length;
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
            if (stateObj.finalExperimentalScore >= 6) {
                expScore = 6;
            }
            else {
                expScore = stateObj.finalExperimentalScore;
            }
            if (stateObj.publications.length >= 5) {
                pubScore = 5;
            }
            else {
                pubScore = stateObj.publications.length;
            }
            if (stateObj.finalExperimentalScore >= 6) {
                expScore = 6;
            }
            else {
                expScore = stateObj.finalExperimentalScore;
            }
            stateObj.totalScore = {'proband':probandScore, 'pub':pubScore, 'time':timeScore, 'exp':expScore};

            var totalScore = probandScore + pubScore + timeScore + expScore;
            if (totalScore > 16){
                stateObj.autoClassification = 'Definitive';
            }
            else if (totalScore > 12) {
                stateObj.autoClassification = 'Strong';
            }
            else if (totalScore > 9) {
                stateObj.autoClassification = 'Moderate';
            }
            else {
                stateObj.autoClassification = 'Limited';
            }

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
        return (
            <div className="container">
                <h1>Summary and Provisional Classification</h1>
                <hr width="100%" />
                <table>
                    <tr><td width="150px"><strong>Login User</strong></td><td width="400px">{this.state.user}</td></tr>
                    <tr><td><strong>url</strong></td><td>{this.state.url}</td></tr>
                    <tr><td><strong>db gdm id</strong></td><td>{this.state.gdm.uuid}</td></tr>
                </table>
                <hr width="100%" />
                <h3>Calculated Score / Assigned Classification: {this.state.totalScore.time + this.state.totalScore.proband + this.state.totalScore.pub + this.state.totalScore.exp} / {this.state.autoClassification}</h3>
                <h4>Final Exp. Score: {this.state.finalExperimentalScore} -- {this.state.totalScore.exp}</h4>
                <h4># Proband: {this.state.familiesCollected.length + this.state.individualsCollected.length} -- {this.state.totalScore.proband}</h4>
                <h4># Publications: {this.state.publications.length} -- {this.state.totalScore.pub}</h4>
                <h4># Years: {this.state.years} -- {this.state.totalScore.time}</h4>
                <hr width="100%" />
                <h4># Scored Experimental Evidence: {this.state.assessed_exp.length}</h4>
                <table>
                    <tr><td width="60px"><strong>Exp</strong></td><td width="300px"><strong>Type</strong></td><td width="100px"><strong>Unit Score</strong></td></tr>
                    {this.state.assessed_exp.map(function(exp, i) { return <tr><td>{i}</td><td>{exp.type}</td><td align="center">{exp.score}</td></tr>; })}
                </table>
                <hr width="100%" />
                <h4># Variants assessed: {this.state.assessed_patho.length}</h4>
                <table>
                    <tr><td width="300px"><strong>Pathogenicity</strong></td><td width="300px"><strong>Variant</strong></td><td width="100px"><strong>Assessment</strong></td><td width="300px"><strong>By</strong></td></tr>
                    {this.state.assessed_patho.map(function(variant) { return <tr><td>{variant.patho}</td><td>{variant.variant}</td><td>{variant.value}</td><td>{variant.assessedBy}</td></tr>; })}
                </table>
                <h4># Variants Associated to Family: {this.state.familiesCollected.length}; # Proband Counted in Families: {this.state.testStr}</h4>
                <table>
                    <tr><td width="300px"><strong>Family</strong></td><td width="300px"><strong>Variant</strong></td><td width="100px"><strong>PMID</strong></td><td width="300px"><strong>Pub Year</strong></td></tr>
                    {this.state.familiesCollected.map(function(item) { return <tr><td>{item.family}</td><td>{item.variant}</td><td>{item.pmid}</td><td>{item.year}</td></tr>; })}
                </table>
                <h4># Proband Counted in Individuals: {this.state.individualsCollected.length}</h4>
                <table>
                    <tr><td width="300px"><strong>Individual</strong></td><td width="300px"><strong>Variant</strong></td><td width="100px"><strong>PMID</strong></td><td width="300px"><strong>Pub Year</strong></td></tr>
                    {this.state.individualsCollected.map(function(item) { return <tr><td>{item.individual}</td><td>{item.variant}</td><td>{item.pmid}</td><td>{item.year}</td></tr>; })}
                </table>
            </div>
        );
    }

});

globals.curator_page.register(ProvisionalCuration,  'curator_page', 'provisional-curation');

var in_array = function(item, list) {
    for(var i in list){
        if (list[i] == item) {
            return true;
        }
    }
    return false;
};

var setEarliestYear = function(earliest, dateStr) {
    var pattern = new RegExp(/^\d\d\d\d/);
    var theYear = pattern.exec(dateStr);
    if (theYear && theYear.valueOf() < earliest.valueOf()) {
        return theYear;
    }
    return earliest;
};

var array_append =function(target, branch, article) {
    for (var i in branch) {
        target.push({"evidenceObj":branch[i], "article":article});
    }
    return target;
};
