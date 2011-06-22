/*!
 * jQuery UI TableGrid 0.3.1
 *
 * Copyright (c) 2010 Wei Kin Huang (<a href="http://www.incrementbyone.com">Increment By One</a>)
 *
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 *
 * Depends:
 *	jquery.ui.widget.js
 */
(function($, undefined) {
	$.widget("ui.tablegrid", {
		widgetEventPrefix : "tablegrid",
		options : {
			headerSelector : "thead:first tr:first th",
			headerSortSelector : "",
			sortMultiSortKey : "shiftKey",
			defaultOrder : "asc",
			cancelSelection : true,
			tableClass : "",
			sortList : [],
			parsers : [],
			delay : 0,
			filter : "*",
			childSelector : "",
			// events
			start : function(e, ui) {
			},
			stop : function(e, ui) {
			},
			update : function(e, ui) {
			}
		},
		cache : null,
		headers : null,
		parsers : null,
		sortList : null,
		updateThrottle : null,
		table : null,
		_create : function() {
			var self = this;

			this.cache = [];
			this.headers = [];
			this.parsers = [];
			this.sortList = [];
			this.update();
			this._loadHeaders();

			this.element.addClass("ui-tablegrid ui-widget ui-helper-reset").bind("update.tablegrid", function(e, callback) {
				if (!self.options.delay) {
					self.update();
					if (callback) {
						callback.call(this);
					}
					return;
				}
				if (self.updateThrottle) {
					clearTimeout(self.updateThrottle);
				}
				self.updateThrottle = setTimeout(function() {
					self.update();
					self.updateThrottle = null;
					if (callback) {
						callback.call(this);
					}
				}, self.options.delay);
			}).bind("sortrows.tablegrid", function() {
				// cannot use sort because juqery ui will break this!
				$.each(Array.prototype.slice.call(arguments, 1), function(i, sort) {
					self._triggerSort(sort[0], sort[1] || self.options.defaultOrder, i < 0);
				});
			});
		},
		_setOption : function(key, value) {
			$.Widget.prototype._setOption.apply(this, arguments);
		},
		destroy : function() {
			this.element.removeClass("ui-tablegrid ui-widget ui-helper-reset").removeAttr("role");
			this.element.find(".ui-tablegrid-header").removeClass("ui-tablegrid-header ui-tablegrid-sort-asc ui-tablegrid-sort-desc");
			$.Widget.prototype.destroy.apply(this);
		},
		update : function() {
			if (this.updateThrottle) {
				clearTimeout(this.updateThrottle);
			}
			this._setParsers();
			this.cache = this._buildCache();
			this._trigger("update", null, {});
		},
		_setParsers : function(parsers) {
			this.parsers = this._loadParsers(parsers || this.options.parsers);
		},
		_loadHeaders : function() {
			var self = this;
			this.headers = [];
			this.element.find(this.options.headerSelector).each(function(i) {
				// here we want to bind the events for sorting
				var sort_trigger = $(this);
				self.headers.push((sort_trigger.is("td,th") ? sort_trigger : sort_trigger.closest("td,th")).addClass("ui-tablegrid-header"));
				if (self.options.headerSortSelector) {
					sort_trigger = sort_trigger.find(self.options.headerSortSelector);
				}
				if (self.parsers[i] === false) {
					sort_trigger.bind("click.tablegrid", function(e) {
						e.preventDefault();
						return false;
					});
					return;
				} else {
					sort_trigger.bind("click.tablegrid", function(e) {
						e.preventDefault();
						self._triggerSort(i, self._getSortOrder(i), e[self.options.sortMultiSortKey]);
						return false;
					});
				}
				if (self.options.cancelSelection) {
					sort_trigger.disableSelection();
				}
			});
		},
		_getSortOrder : function(i) {
			var n, l = this.sortList.length;
			for (n = 0; n < l; n++) {
				if (this.sortList[n].index == i) {
					return this._sanitizeSortOrder(this.sortList[n].order) == "asc" ? "desc" : "asc";
				}
			}
			return this._sanitizeSortOrder(this.options.defaultOrder);
		},
		_loadParsers : function(parsers) {
			parsers = parsers || [];
			var total_cells = (this.element[0].tBodies[0].rows[0] && this.element[0].tBodies[0].rows[0].cells.length) || parsers.length || 0;
			var p = [], i, j, detect, c;
			for (i = 0; i < total_cells; i++) {
				if (parsers[i]) {
					p.push(this._getParser(parsers[i]));
					continue;
				}
				if (parsers[i] === false) {
					p.push(false);
					continue;
				}
				c = this.element[0].tBodies[0].rows[0].cells[i];
				for (j in $.ui.tablegrid.parsers) {
					if (j !== "text") {
						if ($.ui.tablegrid.parsers[j].is.call(c, $(c))) {
							detect = $.ui.tablegrid.parsers[j];
							break;
						}
					}
				}
				if (!detect) {
					detect = this._getParser("text");
				}
				p.push(detect);
			}
			return p;
		},
		_getParser : function(name) {
			var type = typeof name;
			// if a string is passed in, get it from the list of existing parsers
			if (type === "string") {
				return $.ui.tablegrid.parsers[name] || $.ui.tablegrid.parsers.text;
			}
			// if a function is passed in, create the parser object
			if (type === "function") {
				return {
					format : name
				};
			}
			// else return what was passed in
			return name;
		},
		_buildCache : function() {
			var jrows = $("tr", this.element[0].tBodies[0]).filter(this.options.filter);
			if (this.options.childSelector) {
				jrows = jrows.not(this.options.childSelector);
			}
			var rows = jrows.get();
			var total_rows = rows.length || 0;
			var total_cells = (rows[0] && rows[0].cells.length) || 0;
			var row_cache = [], cell_cache, i, j, r, c, cr;
			for (i = 0; i < total_rows; i++) {
				cell_cache = [];
				r = $(rows[i]);
				for (j = 0; j < total_cells; j++) {
					c = $(r[0].cells[j]);
					cell_cache.push({
						td : c,
						value : this.parsers[j] ? this.parsers[j].format.apply(c[0], [ c, r, this.element[0] ]) : 0
					});
				}
				cr = null;
				if (this.options.childSelector && r.next().is(this.options.childSelector)) {
					cr = r.next();
				}
				row_cache.push({
					tr : r,
					cells : cell_cache,
					child : cr
				});
				cell_cache = null;
			}
			return row_cache;
		},
		_updateTableOrder : function(rows) {
			var tbody = this.element[0].tBodies[0], l = rows.length, i;
			for (i = 0; i < l; i++) {
				tbody.appendChild(rows[i].tr[0]);
				if (rows[i].child) {
					tbody.appendChild(rows[i].child[0]);
				}
			}
		},
		_triggerSort : function(index, type, append) {
			var t, i, l;
			if (!append) {
				this.sortList = [];
			} else {
				t = [];
				for (i = 0, l = this.sortList.length; i < l; i++) {
					if (this.sortList[i].index != index) {
						t.push(this.sortList[i]);
					}
				}
				this.sortList = t;
			}
			this.sortList.push({
				index : index,
				order : this._sanitizeSortOrder(type)
			});
			if (this._trigger("start", null, {}) === false) {
				this._trigger("stop", null, {
					sort : []
				});
				return;
			}
			this._updateHeaderCss(this.sortList);
			this._updateTableOrder($.ui.tablegrid.sortMulti(this.cache, this.sortList));
			this._trigger("stop", null, {
				sort : $.map(this.sortList, function(o) {
					return {
						index : o.index,
						order : o.order == "asc" ? 1 : -1
					};
				})
			});
		},
		_updateHeaderCss : function(sort) {
			$.each(this.headers, function() {
				this.removeClass("ui-tablegrid-sort-asc ui-tablegrid-sort-desc");
			});
			var i, l = sort.length;
			for (i = 0; i < l; i++) {
				this.headers[sort[i].index].addClass("ui-tablegrid-sort-" + sort[i].order);
			}
		},
		_sanitizeSortOrder : function(type) {
			return type == 1 || (type + "").toLowerCase() == "asc" ? "asc" : "desc";
		}
	});

	$.extend($.ui.tablegrid, {
		parsers : {},
		addParser : function(name, options) {
			$.ui.tablegrid.parsers[name] = {
				is : options.is || function() {
					return false;
				},
				format : options.format || function() {
					return "";
				},
				type : options.type || "string"
			};
		},
		sortAsc : function(rows, index) {
			return rows.slice(0).sort(function(a, b) {
				return ((a.cells[index].value < b.cells[index].value) ? -1 : ((a.cells[index].value > b.cells[index].value) ? 1 : 0));
			});
		},
		sortDesc : function(rows, index) {
			return rows.slice(0).sort(function(a, b) {
				return ((b.cells[index].value < a.cells[index].value) ? -1 : ((b.cells[index].value > a.cells[index].value) ? 1 : 0));
			});
		},
		sortMulti : function(rows, indicies) {
			if (indicies.length === 0) {
				return rows.slice(0);
			}
			if (indicies.length === 1) {
				return $.ui.tablegrid["sort" + (indicies[0].order === "asc" ? "Asc" : "Desc")](rows, indicies[0].index);
			}
			var l = indicies.length - 1;
			return rows.slice(0).sort(function(a, b) {
				var i = 0;
				while (a.cells[indicies[i].index].value == b.cells[indicies[i].index].value && i < l) {
					i++;
				}
				if (indicies[i].order === "asc") {
					return ((a.cells[indicies[i].index].value < b.cells[indicies[i].index].value) ? -1 : ((a.cells[indicies[i].index].value > b.cells[indicies[i].index].value) ? 1 : 0));
				}
				return ((b.cells[indicies[i].index].value < a.cells[indicies[i].index].value) ? -1 : ((b.cells[indicies[i].index].value > a.cells[indicies[i].index].value) ? 1 : 0));
			});
		}
	});

	// add default parsers
	$.ui.tablegrid.addParser("text", {
		is : function() {
			return true;
		},
		format : function(c) {
			return $.trim(c.text().toLowerCase());
		}
	});
})(jQuery);