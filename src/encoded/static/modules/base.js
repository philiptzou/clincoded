define(['exports', 'jquery', 'underscore', 'backbone', 'backbone.hal', 'assert'],
function base(exports, $, _, Backbone, HAL, assert) {

    // Underscore template settings
    // `{model.title}` for escaped text
    // `<?raw variable ?>}` for raw html interpolations
    // `<?js expression ?>` for javascript evaluations
    _.templateSettings = {
          escape : /\{(.+?)\}/g,
          interpolate : /<\?raw\s+(.+?)\?>/g,
          evaluate : /<\?js\s+(.+?)\?>/g
    };

    // See: https://gist.github.com/4659318
    // Works with function or class
    function new_(factory, args) {
        var obj = Object.create(factory.prototype);
        var result = factory.apply(obj, args);
        if (result === undefined) {
          result = obj;
        }
        return result;
    }

    // The view registry allows for a Pyramid like pattern of view registration.
    var ViewRegistry = exports.ViewRegistry = function ViewRegistry() {
        this.deferred = [];
        this.routes = {};
        this.current_views = {}; // Mapping from slot_name -> currently active view
        this.slots = {};
        this.views = {};
    };

    // Cached regex for stripping a leading hash/slash and trailing space.
    var routeStripper = /^[#\/]|\s+$/g;

    // Cached regex for removing a trailing slash.
    var trailingSlash = /\/$/;

    var OverlayHistory = exports.overlayHistory = Backbone.History.extend({
        path: '',
        constructor: function() {
            OverlayHistory.__super__.constructor.apply(this, arguments);
            this.overlay_handlers = [];
        },
        // Add a route to be tested when the overlay changes. Routes added later
        // may override previous routes.
        routeOverlay: function(route, callback) {
          this.overlay_handlers.unshift({route: route, callback: callback});
        },
        getFragment: function(fragment, forcePushState) {
          if (fragment == null) {
            if (this._hasPushState || !this._wantsHashChange || forcePushState) {
              fragment = this.location.pathname;
              var root = this.root.replace(trailingSlash, '');
              if (!fragment.indexOf(root)) fragment = fragment.substr(root.length);
              var hash = this.getHash();
              if (hash) fragment = fragment + '#' + hash;
            } else {
              fragment = this.getHash();
            }
          }
          return fragment.replace(routeStripper, '');
        },
        loadOverlay: function(overlay) {
            _.any(this.overlay_handlers, function(handler) {
                if (handler.route.test(overlay)) {
                    handler.callback(overlay);
                    return true;
                }
            });
        },
        loadUrl: function(fragmentOverride) {
            var fragment = this.fragment = this.getFragment(fragmentOverride);
            var hash_pos = fragment.indexOf('#');
            var overlay, path;
            if (hash_pos >= 0) {
                overlay = fragment.substr(hash_pos + 1);
                path = fragment.substr(0, hash_pos);
            } else {
                overlay = '';
                path = fragment;
            }
            if (path === this.path) {
                this.loadOverlay(overlay);
                return true;
            }
            this.path = path;
            var matched = _.any(this.handlers, _.bind(function(handler) {
                if (handler.route.test(path)) {
                    handler.callback(path);
                    return true;
                }
            }, this));
            if (matched) this.once('route', _.bind(this.loadOverlay, this, overlay));
            return matched;
        }
    });

    var DeferredRouter = exports.DeferredRouter = Backbone.Router.extend({
        route: function(route, name, callback) {
          if (!_.isRegExp(route)) route = this._routeToRegExp(route);
          if (!callback) callback = this[name];
          Backbone.history.route(route, _.bind(function(fragment) {
            var args = this._extractParameters(route, fragment);
            args.push(fragment.replace(/\/.*/g, '/'));
            if (callback) $.when(callback.apply(this, args)).done(_.bind(function () {
                this.trigger.apply(this, ['route:' + name].concat(args));
                Backbone.history.trigger('route', this, name, args);
                console.log("routed: "+location.href);
            }, this)).fail(_.bind(function () {
                console.log("route failed...");
            }, this));
          }, this));
          return this;
        },
        routeOverlay: function(route, name, callback) {
          if (!_.isRegExp(route)) route = this._routeToRegExp(route);
          if (!callback) callback = this[name];
          Backbone.history.routeOverlay(route, _.bind(function(fragment) {
            var args = this._extractParameters(route, fragment);
            args.push(fragment.replace(/\/.*/g, '/'));
            if (callback) $.when(callback.apply(this, args)).done(_.bind(function () {
                this.trigger.apply(this, ['overlay:' + name].concat(args));
                Backbone.history.trigger('overlay', this, name, args);
                console.log("overlay: "+location.href);
            }, this)).fail(_.bind(function () {
                console.log("overlay failed...");
            }, this));
          }, this));
          return this;
        }
    });

    exports.view_registry = new ViewRegistry();

    _.extend(ViewRegistry.prototype, {
        add_slot: function add_slot(slot_name, selector) {
            this.slots[slot_name] = $(selector);
        },

        add_route: function add_route(route_name, patterns) {
            this.routes[route_name] = patterns;
        },

        defer: function defer(view) {
            this.deferred.push(view);
        },

        make_route_controller: function make_route_controller(view_factory, model_factory) {
            function route_controller() {
                var options = {},
                    deferred;
                if (model_factory) {
                    options.model = new_(model_factory, [null, {route_args: arguments}]);
                    // possibly redundant
                    deferred = options.model.deferred;
                }
                view = new_(view_factory, [options]);
                if (view.deferred !== undefined) deferred = view.deferred;
                $.when(deferred).done(_.bind(function () {
                    this.switch_to(view);
                }, this));
                return deferred;
            }
            return _.bind(route_controller, this);
        },

        process_deferred: function process_deferred() {
            var view_registry = this;
            _(this.deferred).each(function (view_factory) {
                var route_name = view_factory.route_name;
                if (!route_name) return;
                assert(!view_registry.views[route_name], 'route already defined for ' + route_name);
                view_registry.views[route_name] = view_factory;
                console.log("Adding view for: "+ route_name);
            });
            this.deferred = null;
        },

        make_router: function make_router(routes) {
            Backbone.history = new OverlayHistory();
            this.process_deferred();
            var router = this.router = new DeferredRouter();
            var rev_routes = _(_(this.routes).map(function (patterns, route_name) {
                return _(patterns).map(function (patt) {
                    return { route_name: route_name, pattern: patt };
                });
            })).flatten().reverse();
            var view_registry = this;
            _(rev_routes).each(function (route) {
                var view_factory = view_registry.views[route.route_name];
                assert(view_factory, 'missing view for route ' + route.route_name);
                var callback = view_registry.make_route_controller(view_factory, view_factory.model_factory);
                router.route(route.pattern, route.route_name, callback);
            });
            return router;
        },

        switch_to: function switch_to(view, no_render) {
            var slot_name = Object.getPrototypeOf(view).constructor.slot_name;
            var current_view = this.current_views[slot_name];
            if (!no_render) view.render();
            if (current_view) current_view.remove();
            if (!no_render) this.slots[slot_name].html(view.el);
            this.current_views[slot_name] = view;
        }
    });


    // Base View class implements conventions for rendering views.
    exports.View = Backbone.View.extend({
        title: undefined,
        description: undefined,

        // Views should define their own `template`
        template: undefined,
        // surprisingly this function is necessary...
        update: function update() {},
        // Render the view
        render: function render() {
            this.update();
            var properties = this.model && this.model.toJSON();
            this.$el.html(this.template({model: this.model, properties: properties, view: this, '_': _}));
            return this;
        }

    }, {
        view_registry: exports.view_registry,
        slot_name: 'content'
    });

    exports.View.extend = function extend(protoProps, classProps) {
        var view = Backbone.View.extend.apply(this, arguments);
        this.view_registry.defer(view);
        return view;
    };

    exports.RowView = exports.View.extend({
        tagName: 'tr',

        initialize: function initialize(options) {
            var model = options.model;
            this.deferred = model.deferred;
            this.template = options.template;
        },

        update: function update() {
            this.$el.attr('data-href', this.model.url());
            this.$el.css('cursor', 'pointer');
        }
    });

    exports.CollectionView = exports.View.extend({
        initialize: function initialize(options, type) {
            var collection = options.model,
                deferred = $.Deferred(),
                deferred2 = $.Deferred();
            this.deferred = deferred;
            this.deferred2 = deferred2;
            $.when(collection.fetch({data: {limit: 30}})).done(_.bind(function () {
                this.title = collection.title;
                this.description = collection.description;
                this.rows = collection.map(_.bind(this.render_subviews, this));
                $.when.apply($, _.pluck(this.rows, 'deferred')).then(function () {
                    deferred.resolve();
                });

            }, this));
            $.when(collection.fetch()).done(_.bind(function () {
                this.rows = collection.map(_.bind(this.render_subviews, this));
                $.when.apply($, _.pluck(this.rows, 'deferred')).then(function () {
                    deferred2.resolve();
                });
            }, this));
            deferred2.done(_.bind(function()  {
                console.log("2nd deferred");
                if (deferred.state() === 'resolved') {
                    this.render();
                } else {
                    deferred.resolve();
                }
                var $table = this.$el.find('table');
                $("#table-count").text(function(index, text) {
                    return $("#collection-table > tbody > tr").length;
                });
                $("#table-count").removeClass("label-warning").removeClass("spinner-warning").addClass("label-invert");
                $(".table-filter").removeAttr("disabled");
                $("#total-records").removeClass("hide");
                $table.table_sorter().table_filter();

            }, this));
           // XXX .fail(...)
        },

        row: exports.RowView,

        render_subviews: function (item) {
            var subview = new this.row({model: item, template: this.row_template});
            $.when(subview.deferred).then(function () {
                subview.render();
            });
            return subview;
        }
    });

    var TableView = exports.TableView = exports.CollectionView.extend({
        //row: undefined,  should be set in subclass
        render: function render() {
            console.log("Rendering table for "+this.model.attributes.title);
            TableView.__super__.render.apply(this, arguments);
            var $table = this.$el.find('table');
            var $tbody = $table.children('tbody:first');
            _.each(this.rows, function (view) {
                $tbody.append(view.el);
            });

            return this;
        },

        events: {
            "click td": "link"
        },

        link: function(event) {
            console.log("table cell clicked");
            $td = $(event.currentTarget);
            $anchs = $td.children("a");
            if ($anchs.length == 1) {
                $anchs[0].click();
                return;
            } else if ($anchs.length) {
                // can't pick anchor so do nothing
                return;
            }

            Backbone.history.navigate($td.parents("tr[data-href]").attr("data-href"), true);
        }

    });

    exports.Model = HAL.Model.extend({});

    exports.Collection = HAL.Collection.extend({
        search: function(letters) {
            if(letters === "") return this;

            var pattern = new RegExp(letters,"gi");
            return _(this.filter(function(data) {
                return pattern.test(data.get());
            }));
        }
    });

    return exports;
});
