var url      = require('url')
  , _        = require('underscore')
  , err      = require('./error')
  , defaults = {uri: "http://admin:admin@localhost:4830"}
  , request;

/*
 * nuvem module
 * e.g. var nuvem = require('nuvem')('http://user:pass@localhost:123');
 */
module.exports = exports = function nuvem_module(cfg) {
  var public_functions = {}
    , current = cfg || {};

  if(typeof cfg === "string") {
    if(/^https?:/.test(cfg)) { current = {uri: cfg}; } // url
    else { 
      try { current = require(cfg); } // file
      catch(e) { console.error("bad cfg: couldn't load file"); } 
    }
  }
  if(!current.uri) {
    console.error("bad cfg: using default=" + defaults.uri);
    current.uri = defaults.uri; // if everything else fails, use default
  }
  request = require('./request')(current); // proxy support cfg.proxy

 /*
  * insert a json document
  *
  * @param {uri:string} the document uri
  * @param {document:object|string} the json document you want to store
  * @param {opts:object:optional} extra query string params like quality
  * @param {callback:function:optional} function to call back
  *
  * @see request.js#json
  */
  function insert_json(uri,document,opts,callback) {
    if (typeof opts === 'function') {
     callback = opts;
     opts = {};
    }
    var req = { resource: 'json/store'
              , path: uri.replace(/^\/(.*)/, "$1")
              , method: 'PUT'
              , params: opts
              , body: document
              };
    return request.json(req, callback);
  }

 /*
  * get a json document
  *
  * e.g. 
  *   db.json.get("a", function (err,doc,headers) {
  *     if(err) { throw err; }
  *     return document;
  *   });
  *
  * @param {uri:string} the document uri
  * @param {opts:object:optional} extra query string params like quality
  * @param {callback:function:optional} function to call back
  *
  * @see request.js#json
  */
  function get_json(uri,opts,callback) {
    if (typeof opts === 'function') {
     callback = opts;
     opts = {};
    }
    var get = { resource: 'json/store'
              , path: uri.replace(/^\/(.*)/, "$1")
              , params: opts
              };
    return request.json(get, callback);
  }
  
 /*
  * deletes a json document
  * 
  * e.g. 
  *   db.json.destroy("a", function (err) {
  *     if(err) { throw err; }
  *     return;
  *   });
  *
  * @param {uri_or_opts:string|object} the document uri
  * @param {callback:function:optional} function to call back
  *
  * @see request.js#json
  */
  function destroy_json(uri_or_opts,callback) {
    var del = { resource: 'json/store' , method: "DELETE" };
    if (typeof uri_or_opts === 'object') { del.params = uri_or_opts; } // opts
    else { del.path = uri_or_opts.replace(/^\/(.*)/, "$1"); } // path
    return request.json(del, callback);
  }

 /*
  * query json documents
  *
  * https://github.com/marklogic/Corona/wiki/Custom-Query-Service
  *
  * e.g. var login = "dscape";
  *      db.json.query( { "box": { "north": 1
  *                              , "east": 1
  *                              , "south": -1
  *                              , "west": -1
  *                              }
  *                     }
  *                  , { start: 1
  *                    , end: 10
  *                    }
  *                  , function (e,b,h) {
  *                      if(e) { return console.log(err); }
  *                      var localtions = response.results[0];
  *                      console.log(locations);
  *                    });
  *
  * @param {query:object} the query
  * @param {opts:object:optional} aditional querystring params
  * @param {callback:function:optional} function to call back
  *
  * @return a json response containing outputs in the "results" property
  */
  function query_json(query,opts,callback) {
    if (typeof opts === 'function') {
     callback = opts;
     opts = {};
    }
    var get = { resource: 'json/customquery'
              , params: _.extend(opts, {q: JSON.stringify(query) })
              };
    request.json(get, function (e,b,h){
      if(e) { return callback(e,b,h); }
      if(opts.start === opts.end && b.results[0]) {
        b = b.results[0];
      }
      return callback(null,b,h);
    });
  }

 /*
  * find json documents matching either a qs query or kv query
  *
  * https://github.com/marklogic/Corona/wiki/Key-Value-Query-Service
  *
  * e.g. var login = "dscape";
  *      db.json.find( { github: login
  *                    , twitter: login 
  *                    }
  *                  , { start: 1
  *                    , end: 10
  *                    }
  *                  , function (e,b,h) {
  *                      if(e) { return console.log(err); }
  *                      var user_from_db = response.results[0];
  *                      console.log(user_from_db);
  *                    });
  *
  * @error {nuvem:INVALID-QUERY} query was neither a string or a kv object
  *
  * @param {query:string|object} the query
  * @param {opts:object:optional} either index or start & end
  * @param {callback:function:optional} function to call back
  *
  * @return a json response containing outputs in the "results" property
  */
  function find_json(query,opts,callback) {
    var get = {};
    if (typeof opts === 'function') {
     callback = opts;
     opts = {};
    }
    if(typeof query === "string") {
      get.resource = 'json/query';
      get.params   = _.extend({q: query}, opts);
    }
    else if(typeof query === "object") {
      get.resource = 'json/kvquery';
      get.params = _.extend(
        _.foldl(
          _.keys(query), 
          function (memo,e) { 
            memo.key.push(e); 
            memo.value.push(query[e]); 
            return memo; },
          {key: [], value: []}),
      opts);
    }
    else {
      return callback(err.nuvem("Please provide either a string or a kv object", "INVALID-QUERY"));
    }
    request.json(get, function (e,b,h){
      if(e) { return callback(e,b,h); }
      if(opts.start === opts.end && b.results[0]) {
        b = b.results[0];
      }
      return callback(null,b,h);
    });
  }

 /*
  * alias for find_json(query, {index: n}, callback).response.results[0]
  *
  * @see find_json
  */
  function find_nth_json(n,query,callback) {
    find_json(query,{start: n, end: n},callback);
  }

 /*
  * alias for find_json(query, {index: 1}, callback).response.results[0]
  *
  * @see find_json
  */
  function first_json(query, callback) {
    find_json(query, {start:1, end: 1}, callback);
  }
  
  /*
   * returns information about the server version, 
   * hardware and index settings, and more...
   *
   * @param {callback:function:optional} function to call back
   *
   * @return json information regarding the service
   */
   function manage_info(callback) {
     request.json({resource: 'manage'}, callback);
   }

  /*
   * create(s) a field
   * https://github.com/marklogic/Corona/wiki/Field-Management
   *
   * @param {field_name:string} field name
   * @param {opts:object:optional} aditional querystring params
   * @param {callback:function:optional} function to call back
   *
   * @return the body returned from corona
   */
   function create_field(field_name,opts,callback) {
     request.json({ resource: 'manage/field'
                  , path: field_name
                  , params: opts
                  , method: 'POST'
                  }, callback);
   }

  /*
   * get a field
   *
   * @param {field_name:string} field name
   * @param {callback:function:optional} function to call back
   *
   * @return information about the field
   */
   function get_field(field_name,callback) {
     request.json({resource: 'manage/field', path: field_name}, callback);
   }

  /*
   * delete a field
   *
   * @param {field_name:string} field name
   * @param {callback:function:optional} function to call back
   *
   * @return the body returned from corona
   */
   function delete_field(field_name,callback) {
     request.json({ resource: 'manage/field'
                  , path: field_name
                  , method: 'DELETE'
                  }, callback);
   }

  /*
   * create(s) a range index
   * https://github.com/marklogic/Corona/wiki/Range-Index-Management
   *
   * @param {idx_name:string} the index name
   * @param {opts:object:optional} aditional querystring params
   * @param {callback:function:optional} function to call back
   *
   * @return the body returned from corona
   */
   function create_range(idx_name,opts,callback) {
     request.json({ resource: 'manage/range'
                  , path: idx_name
                  , params: opts
                  , method: 'POST'
                  }, callback);
   }

  /*
   * get a range index
   *
   * @param {idx_name:string} the index name
   * @param {callback:function:optional} function to call back
   *
   * @return information about the field
   */
   function get_range(idx_name,callback) {
     request.json({resource: 'manage/range', path: idx_name}, callback);
   }

  /*
   * delete a range index
   *
   * @param {idx_name:string} field name
   * @param {callback:function:optional} function to call back
   *
   * @return the body returned from corona
   */
   function delete_range(idx_name,callback) {
     request.json({ resource: 'manage/range'
                  , path: idx_name
                  , method: 'DELETE'
                  }, callback);
   }

  public_functions = { options:
    { current: current
    , defaults: defaults
    }
  , json:
    { get: get_json
    , insert: insert_json
    , destroy: destroy_json
    , find: find_json
    , first: first_json
    , nth: find_nth_json
    , query: query_json
    }
 , manage: 
   { info: manage_info
   , field:
     { get: get_field
     , create: create_field
     , destroy: delete_field
     }
   , range:
     { get: get_range
     , create: create_range
     , destroy: delete_range
     }
   }
 };

  return public_functions;
};