var connector = DataStudioApp.createCommunityConnector();

var apiBaseUrl = 'https://api.github.com/users/';

function isAdminUser() {
  return false;
}

function getAuthType() {
  var authTypes = connector.AuthType;
  return connector.newAuthTypeResponse().setAuthType(authTypes.NONE).build();
}

function getConfig() {
  var config = connector.getConfig();
  
  config.newInfo()
    .setId("instructions")
    .setText("Please enter the user names whose data you want to visualize");
  
  config.newTextInput()
    .setId("userName")
    .setName("User Name")
    .setPlaceholder("UserName(s)")
    .setHelpText("Enter up to 10 github usernames for comparison");
  
  return config.build();
}

function getFields() {
  var fields = connector.getFields();
  var types = connector.FieldType;

  fields
    .newDimension()
    .setId('userName')
    .setName('userName')
    .setType(types.TEXT);

  fields
    .newMetric()
    .setId('followers')
    .setName('followers')
    .setType(types.NUMBER)
  
  fields
    .newMetric()
    .setId('following')
    .setName('following')
    .setType(types.NUMBER)
  
  fields
    .newMetric()
    .setId('publicRepos')
    .setName('publicRepos')
    .setType(types.NUMBER)
  
  fields
    .newMetric()
    .setId('publicGists')
    .setName('publicGists')
    .setType(types.NUMBER)

  return fields;
}

function getSchema(request) {
  var userNames = request.configParams.userName;
  userNames = userNames.replace(/\s+/g, '');
  userNames = userNames.split(',');
  var configValid = validateConfig(userNames);
  if (!configValid) {
    throwConnectionError('Please check the if all usernames are valid', true);
  }
  var fields = getFields().build();
  return {schema: fields};
}

function getData(request) {
  var responses = [];
  var userNames = request.configParams.userName;
  userNames = userNames.replace(/\s+/g, '');
  userNames = userNames.split(',');

  userNames.map(function (username) {
    var cache = CacheService.getScriptCache();
    var url = apiBaseUrl + username;
    var cachedResponse = cache.get(url);
    if (cachedResponse === null) {
      try {
        var response = UrlFetchApp.fetch(url);
        cache.put(url, response);
      } catch (err) {
        return false;
      }
    } else {
      var response = cachedResponse;
    }
    response = JSON.parse(response);
    responses.push(response);
  });
  var requestedFieldIds = request.fields.map(function(field) {
    return field.name;
  });
  var requestedSchema = getFields().forIds(requestedFieldIds).build();
  var requestedData = processData(responses, requestedSchema);
  return {
    schema: requestedSchema,
    rows: requestedData
  };
}

function processData(data, schema) {
  var result = [];
  for (var rowIndex = 0; rowIndex < data.length; rowIndex++) {
    var row = data[rowIndex];
    var rowData = schema.map(function (field) {
      var item = null;
      switch (field.name) {
        case 'followers':
          item = row['followers'];
          break;
        case 'following':
          item = row['following'];
          break;
        case 'userName':
          item = row['login'];
          break;
        case 'publicRepos':
          item = row['public_repos'];
          break;
        case 'publicGists':
          item = row['public_gists'];
          break;
        default:
          item = null;
      }
      return item;
    });
    result.push({
      values: rowData
    });
  }
  return result;
}

function validateConfig(userNames) {
  userNames.map(function (username) {
    var url = apiBaseUrl + username;
    var cache = CacheService.getScriptCache();
    try {
      var response = UrlFetchApp.fetch(url);
      cache.put(url, response);
    } catch (err) {
      return false;
    }
    if (response.getResponseCode() !== 200) {
      return false;
    }
  });
  return true;
}

function throwConnectorError(message, userSafe) {
  userSafe =
    typeof userSafe !== 'undefined' && typeof userSafe === 'boolean'
      ? userSafe
      : false;
  if (userSafe) {
    message = 'DS_USER:' + message;
  }
  throw new Error(message);
}
