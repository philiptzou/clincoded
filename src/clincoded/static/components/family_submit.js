"use strict";
var React = require('react');
var _ = require('underscore');
var globals = require('./globals');
var curator = require('./curator');
var RestMixin = require('./rest').RestMixin;
var form = require('../libs/bootstrap/form');
var panel = require('../libs/bootstrap/panel');

var RecordHeader = curator.RecordHeader;
var PmidSummary = curator.PmidSummary;
var queryKeyValue = globals.queryKeyValue;
var Form = form.Form;
var FormMixin = form.FormMixin;
var Input = form.Input;
var Panel = panel.Panel;


var FamilySubmit = module.exports.FamilySubmit = React.createClass({
    mixins: [FormMixin, RestMixin],

    // Keeps track of values from the query string
    queryValues: {},

    getInitialState: function() {
        return {
            gdm: {}, // GDM object given in query string
            family: {}, // Group object given in query string
            annotation: {}, // Annotation object given in query string
            haveIndividual: '' // Setting of have-individual switch
        };
    },

    // Handle value changes in the form
    handleChange: function(ref, e) {
        if (ref === 'haveindividual') {
            this.setState({haveIndividual: this.refs[ref].getValue()});
        }
    },

    // Load objects from query string into the state variables. Must have already parsed the query string
    // and set the queryValues property of this React class.
    loadData: function() {
        var gdmUuid = this.queryValues.gdmUuid;
        var familyUuid = this.queryValues.familyUuid;
        var annotationUuid = this.queryValues.annotationUuid;

        // Make an array of URIs to query the database. Don't include any that didn't include a query string.
        var uris = _.compact([
            gdmUuid ? '/gdm/' + gdmUuid : '',
            familyUuid ? '/family/' + familyUuid : '',
            annotationUuid ? '/evidence/' + annotationUuid : ''
        ]);

        // With all given query string variables, get the corresponding objects from the DB.
        this.getRestDatas(
            uris
        ).then(datas => {
            // See what we got back so we can build an object to copy in this React object's state to rerender the page.
            var stateObj = {};
            datas.forEach(function(data) {
                switch(data['@type'][0]) {
                    case 'gdm':
                        stateObj.gdm = data;
                        break;

                    case 'family':
                        stateObj.family = data;
                        break;

                    case 'annotation':
                        stateObj.annotation = data;
                        break;

                    default:
                        break;
                }
            });

            // Set all the state variables we've collected
            this.setState(stateObj);

            // Not passing data to anyone; just resolve with an empty promise.
            return Promise.resolve();
        }).catch(function(e) {
            console.log('OBJECT LOAD ERROR: %s — %s', e.statusText, e.url);
        });
    },

    // After the Family Curation page component mounts, grab the GDM, group, family, and annotation UUIDs (as many as given)
    // from the query string and retrieve the corresponding objects from the DB, if they exist. Note, we have to do this after
    // the component mounts because AJAX DB queries can't be done from unmounted components.
    componentDidMount: function() {
        // Get the 'evidence', 'gdm', and 'group' UUIDs from the query string and save them locally.
        this.loadData();
    },

    render: function() {
        var gdm = Object.keys(this.state.gdm).length ? this.state.gdm : null;
        var family = Object.keys(this.state.family).length ? this.state.family : null;
        var annotation = Object.keys(this.state.annotation).length ? this.state.annotation : null;

        // Get the query strings. Have to do this now so we know whether to render the form or not. The form
        // uses React controlled inputs, so we can only render them the first time if we already have the
        // family object read in.
        this.queryValues.gdmUuid = queryKeyValue('gdm', this.props.href);
        this.queryValues.familyUuid = queryKeyValue('family', this.props.href);
        this.queryValues.annotationUuid = queryKeyValue('annotation', this.props.href);

        // Build the link to go back and edit the newly created group page
        var editGroupLink = (gdm && family && annotation) ? '/family-curation/?gdm=' + gdm.uuid + '&evidence=' + annotation.uuid + '&family=' + family.uuid : '';

        return (
            <div>
                <RecordHeader gdm={gdm} omimId={gdm && gdm.omimId} />
                <div className="container">
                    {family ?
                        <h1>Family Information: {family.label} <a href={family['@id']} className="btn btn-info" target="_blank">View</a>&nbsp;<a href={editGroupLink} className="btn btn-info">Edit</a></h1>
                    : null}
                    {annotation && annotation.article ?
                        <div className="curation-pmid-summary">
                            <PmidSummary article={annotation.article} displayJournal />
                        </div>
                    : null}
                    <div className="row">
                        <div className="col-md-8 col-md-offset-2 col-sm-10 col-sm-offset-1">
                            <Panel panelClassName="submit-results-panel" panelBodyClassName="bg-info">
                                <Form formClassName="form-horizontal form-std">
                                    <Input type="select" ref="haveindividual" label="Other than the variant information associated with the proband, is there any additional information provided about the proband or any other individuals in the family?" defaultValue={this.state.haveIndividual}
                                        handleChange={this.handleChange} labelClassName="family-submit-results-label" wrapperClassName="family-submit-results-switch" groupClassName="submit-results-wrapper">
                                        <option value="" disabled="disabled">No Selection</option>
                                        <option disabled="disabled"></option>
                                        <option value="y">Yes</option>
                                        <option value="n">No</option>
                                    </Input>
                                </Form>
                                <p className="submit-results-panel-info">
                                    <em><strong>Note</strong>: Individual Information includes additional phenotypic information, sex, age, etc. for the
                                    proband or other family members, as well as other variants for the family members.</em>
                                </p>
                            </Panel>
                            {(this.state.haveIndividual === 'y' && gdm && annotation && family) ?
                                <Panel panelClassName="submit-results-panel">
                                    <div className="family-submit-results-choices">
                                        <span className="family-submit-results-btn">
                                            <a className="btn btn-default" href={'/individual-curation/?gdm=' + gdm.uuid + '&evidence=' + annotation.uuid + '&family=' + family.uuid}>Add New Individuals for this Family</a>
                                        </span>
                                    </div>
                                </Panel>
                            : ((this.state.haveIndividual === 'n' && gdm && annotation) ?
                                <Panel panelClassName="submit-results-panel">
                                    <div className="family-submit-results-choices">
                                        <span className="family-submit-results-btn">
                                            <a className="btn btn-default" href={'/curation-central/?gdm=' + gdm.uuid + '&pmid=' + annotation.article.pmid}>Return to Record Curation page</a>
                                        </span>
                                        <div className="submit-results-note">Note: To add another family to this group or to associate an existing Individual with this Group, return to the Record Curation page.</div>
                                    </div>
                                </Panel>
                            : null)}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
});

globals.curator_page.register(FamilySubmit, 'curator_page', 'family-submit');