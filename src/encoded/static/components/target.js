/** @jsx React.DOM */
define(['exports', 'react', 'globals', 'jsx!dbxref'],
function (target, React, globals, dbxref) {
    'use strict';

    var DbxrefList = dbxref.DbxrefList;

    var Panel = target.Panel = React.createClass({
        render: function() {
            var context = this.props.context;
            var itemClass = globals.itemClass(context, 'view-detail panel key-value');
            var geneCardBaseURL = "http://www.genecards.org/cgi-bin/carddisp.pl?gene=";
            return (
                <dl class={itemClass}>
                    <dt>Target name</dt>
                    <dd class="no-cap">{context.label}</dd>

                    <dt>Target Gene</dt>
                    <dd><a href={geneCardBaseURL + context.gene_name}>{context.gene_name}</a></dd>

                    <dt>External Resources</dt>
                    <dd>
                        {context.dbxref.length ? 
                            <DbxrefList values={context.dbxref} />
                        : <em>None submitted</em> }
                    </dd>

                </dl>
            );
        }
    });

    globals.panel_views.register(Panel, 'target');

    return target;
});
