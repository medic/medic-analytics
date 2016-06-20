var format = require('pg-format');

function getFromEnv() {
  var config = {};
  config.jsonTable = 'couchdb';
  config.jsonCol = 'doc';
  return config;
}

exports.getFormDefinitionsXML = function() {
  var c = getFromEnv();
  // it is important (yet arbitrary) to name the field "form"
  return format('SELECT %I->>\'_rev\' AS version, (%I #> \'{_attachments,xml,data}\') AS form FROM %I WHERE %I->>\'type\' = \'form\' AND %I->\'_attachments\' ? \'xml\';', c.jsonCol, c.jsonCol, c.jsonTable, c.jsonCol, c.jsonCol);
};

exports.putFormList = function(formlist) {
  // expect formlist to be of the format ['form1', 'form2', ...]
  formlist = formlist.map(function (formname) {
    return format('(%L)', formname);
  }).join(',');
  return 'DROP TABLE IF EXISTS form_list; CREATE TABLE form_list (name TEXT); INSERT INTO form_list VALUES ' + formlist;
};

exports.fetchMissingReportContents = function() {
  var c = getFromEnv();
  // grab specific report fields for each report in Couch but not in formmeta
  return format('SELECT %I->>\'_id\' AS uuid, %I->>\'reported_date\' AS reported, %I#>\'{contact,parent,_id}\' AS area, %I#>\'{contact,_id}\' AS chw, %I->>\'content\' AS xml FROM %I LEFT OUTER JOIN form_metadata AS fmd ON (fmd.uuid = %I->>\'_id\') WHERE %I @> \'{"type": "data_record"}\'::jsonb AND %I ? \'form\' AND fmd.uuid IS NULL;', c.jsonCol, c.jsonCol, c.jsonCol, c.jsonCol, c.jsonCol, c.jsonTable, c.jsonCol, c.jsonCol, c.jsonCol);
};

exports.putFormViews = function(tabledef) {
  // expects an obj of {
  //   'formview_formname_formversion': ['field1','field2',...],
  //   ...
  //  }
  var manyQueries = '';
  Object.keys(tabledef).forEach(function (tableName) {
    // map the fields to include a type
    manyQueries += format('CREATE TABLE IF NOT EXISTS %I (', tableName);
    // format field names and append TEXT type to each
    var fields = tabledef[tableName].map(function (attr) {
      return format('%I', attr) + ' TEXT';
    }).join(',');
    // finalize CREATE TABLE
    manyQueries += fields + ');';
  });
  return manyQueries;
};

exports.writeReportMetaData = function (objs) {
  // expect input objects to be a list of {
  //   'id': 'uuid', 'formname': 'name', 'formversion': 'date',
  //   'chw': 'uuid', 'reported': 'epoch', 'xml': {
  //     'flattened': 'version', 'of': 'xml'
  //   }
  // }

  if ((!objs) || (objs.length === 0)) {
    // null op if there's nothing to do.
    return '';
  }

  // extract relevant values in the order defined below
  var values = objs.map(function (el) {
    return [el.id, el.chw, el.area, el.formname, el.formversion,
            // map epochs to UTC dates
            new Date(parseInt(el.reported)).toUTCString()];
  });
  return format('INSERT INTO form_metadata (uuid, chw, chw_area, formname, formversion, reported) VALUES %L;', values);
};

exports.writeReportContents = function(objs) {
  // take in list of { 'tablename':
  //   'fields': [...],
  //   'docs': [...]
  // }, ... }
  // and write each contained doc to the proper table
  var inserts = '';
  // prepare one INSERT for each table
  Object.keys(objs).forEach(function (tableName) {
    var table = objs[tableName];
    var fields = table.fields;
    // compress all values into a list of lists in the same order as fields.
    var values = table.docs.map(function (doc) {
      // order by fields
      return fields.map(function (field) {
        // extract each field's value from doc
        return doc.xml[field];
      });
    });
    inserts += format('INSERT INTO %I (%I) VALUES %L;', tableName, fields, values);
  });
  return inserts;
};

exports.refreshMatViews = function() {
  return 'SELECT refresh_matviews();';
};
