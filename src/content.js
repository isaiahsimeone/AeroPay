chrome.runtime.sendMessage({todo: "showPageAction"});

// Get public holidays 
window.publicHolidays = [];
getStoredRates().then( getHolidayData() );

// Executed (if settings are valid) upon every change of content_frame and the user has logged in
if(!document.getElementById("login-note-version")) {
    document.querySelector('#content_frame').addEventListener("load", ev => {
        if(window.settingsValid) {
            contentLoaded();
        }
    });
}

// Called every time content inside the content_frame changes (i.e roster page -> home, etc).
function contentLoaded() {
    var frame = document.getElementById("content_frame");
    var frameContent = frame.contentDocument;

    // Tab accesses are reset upon content frame reload/change
    window.accessedTabs = [];

    // Roster page. We are on the roster page if we have a title of the form: 'Shifts for j.doe' and if
    // tabs exist with names "My Shifts", "Available" or "Accept Swap"
    if(["My Shifts", "Available", "Accept Swap"].includes(getCurrentPage(frameContent))) {
        // Count the number of tabs on the roster page i.e. (if available/Accept swap exist)
        var numRosterTabs = frameContent.getElementById("main-content").getElementsByClassName("dynamic-tab-pane-control")[0].getElementsByClassName("tab-page").length;
        var tabs = frameContent.getElementById("main-content").getElementsByClassName("dynamic-tab-pane-control")[0];
      
        // If one additional tab exists, add functionality to it
        if(numRosterTabs > 1) {
            tabs.getElementsByClassName("tab-row")[0].getElementsByTagName("h2")[1].onclick = function() { 
                if(!window.accessedTabs[0]) {rosterHandler(frameContent); window.accessedTabs[0] = 1; }
            };
        }
        // Continue to add functionality for a third tab if it exists
        if(numRosterTabs > 2) {
            tabs.getElementsByClassName("tab-row")[0].getElementsByTagName("h2")[2].onclick = function() { 
                if(!window.accessedTabs[1]) {rosterHandler(frameContent); window.accessedTabs[1] = 1; }
            };
        }

        // Add information stub below 'Swap usage' speel.
        frameContent.getElementsByClassName("smallText")[1].innerHTML += "<br><b>AeroPay:</b> AeroPay provides only an approximation of income per shift/week (before tax) and excluding Loading/Allowances."

        // Pass control to handler
        rosterHandler(frameContent);
    } 
    // Timesheet page
    else if(getCurrentPage(frameContent) == "Timesheet") {
        timesheetHandler(frameContent);
    }  
}

/**
* Handles all modifications to the Roster section of the AeroNet
* @param {Object} frameContent : The current page type that the user is viewing i.e Roster/Timesheet etc.
*/
function rosterHandler(frameContent) {
    // Determine table indices based upon which tab the user is viewing
    var totalTimeIdx, shiftNoteIdx, tableName, countOffset;
    switch(getCurrentPage(frameContent)) {
        default:
        case "My Shifts":
            shiftDateIdx = 0;
            totalTimeIdx = 4;
            shiftNoteIdx = 6;
            countOffset  = 1;
            tableName    = "SHIFTS";
        break;
        case "Available":
            shiftDateIdx = 0;
            totalTimeIdx = 4;
            shiftNoteIdx = 6;
            countOffset  = 0;
            tableName    = "AVSHIFTS";
        break;
        case "Accept Swap":
            shiftDateIdx = 1;
            totalTimeIdx = 5;
            shiftNoteIdx = 8;
            countOffset  = 0;
            tableName    = "SWSHIFTS";
        break;
    }

    // Isolate roster table
    var rosterTable = frameContent.getElementById(tableName).getElementsByClassName("dataTable")[0].getElementsByTagName("tbody")[0];
    // Get the year which the user is currently viewing data for
    var yearInView = getYearFromContent(frameContent, "Roster");
    // Keep running total of approximated payments
    var runningSum = 0;
    // The number of shifts contained in the roster table
    var numShifts = rosterTable.getElementsByTagName("tr").length - countOffset;

    var shiftEntry, shiftDay, shiftDate, shiftLength, shiftArea, textColour, payRate;
    for(var i = 0; i < numShifts; i++) { 
        // Get roster entry (individual table row)
        shiftEntry  = rosterTable.getElementsByTagName("tr")[i].getElementsByTagName("td");
        // Tokenise roster entry
        shiftDay    = shiftEntry[ shiftDateIdx ].innerText.trim().substring(0, 3); // MON, TUE, WED...
        shiftDate   = shiftEntry[ shiftDateIdx ].innerText.trim().substring(4, 9) + "/" +yearInView;  
        shiftLength = shiftEntry[ totalTimeIdx ].innerText.trim();
        shiftArea   = shiftEntry[5].innerText.trim();      
        textColour  = "GREEN";
        payRate     = 0;

        // Is there a shift on this Day? Skip this iteration if the rostered area is 'OFF'
        if(shiftArea === "OFF") {
            continue;
        }

        // Determine relevant pay multiplier
        payRate = getPayRate(shiftDay);

        //Is the date a public holiday?
        if(isPublicHoliday(shiftDate) !== undefined) {
            payRate = 2 * getPayRate("MON");
            textColour = "GOLD";
            shiftEntry[ shiftNoteIdx ].innerHTML += "<span style='float:right';>" + isPublicHoliday(shiftDate) + "</span>";
        }

        shiftEntry[ totalTimeIdx ].innerHTML += getHTMLText(payRate * shiftLength, textColour, false);
        runningSum += (payRate * shiftLength);
    }

    // The row sum should be shown only for the My Shifts tab.
    if(tableName == "SHIFTS") {
        // Append running sum to the total column
        var totalRowData = rosterTable.getElementsByTagName("tr")[numShifts].getElementsByTagName("td");
        totalRowData[ totalTimeIdx ].innerHTML += getHTMLText(runningSum, "GREEN", true);
    }
}

/**
* Handles all modifications to the timesheet section of the AeroNet
* @param {Object} frameContent : The current page type that the user is viewing i.e Roster/Timesheet etc.
*/
function timesheetHandler(frameContent) {
    // Isolate timesheet table
    var timesheetTable = frameContent.getElementsByClassName("dataTable")[0].getElementsByTagName("tbody")[0];
    // Get the year which the user is currently viewing data for
    var yearInView = getYearFromContent(frameContent, "Timesheet");
    // Keep running total of approximated payments
    var runningSum = 0;
    // The number of shifts contained in the timesheet table
    var numShifts = timesheetTable.getElementsByTagName("tr").length - 1;

    var shiftEntry, shiftDay, shiftDate, shiftLength, shiftEntry, textColour, payRate;
    for(var i = 0; i < numShifts; i++) { 
        // Get timetable entry (individual timetable row)
        shiftEntry  = timesheetTable.getElementsByTagName("tr")[i].getElementsByTagName("td");
        // Tokenise timetable entry 
        shiftDay    = shiftEntry[0].innerText.trim().substring(0, 3); 
        shiftLength = shiftEntry[8].innerText.trim();
        shiftDate   = shiftEntry[0].innerText.trim().substring(4, 9) + "/" + yearInView;
        shiftArea   = shiftEntry[4].innerText.trim();
        textColour  = "GREEN";
        payRate     = 0;

        // Determine relevant pay multiplier
        payRate = getPayRate(shiftDay);

        //Is the date a public holiday? (Public holiday rates are not paid for sick days)
        if(isPublicHoliday(shiftDate) !== undefined && shiftArea != "SICK") {
            payRate *= 2;
            textColour = "GOLD";
            shiftEntry[7].innerHTML += "<span style='float:right';>" + isPublicHoliday(shiftDate) + "</span>";
        }

        shiftEntry[8].innerHTML += getHTMLText(payRate * shiftLength, textColour, false);
        runningSum += (payRate * shiftLength);
    }

    var totalRowData = timesheetTable.getElementsByTagName("tr")[numShifts].getElementsByTagName("td");
    totalRowData[8].innerHTML += getHTMLText(runningSum, "GREEN", true);
}

/**
* Returns a formatted HTML string to be displayed to the user
* @param {int} payAmount : The amount to be displayed in the HTML string
* @param {String} colour : The colour that the text should be
* @param {bool} isTotalRow: Is this HTML string for the total row?
*/
function getHTMLText(payAmount, colour, isTotalRow) {
    if(isTotalRow) {
        return "<span style='padding-left:20px;float:right;color:green;font-weight:bold;'>~ $" + payAmount.toFixed(1) + "</span>";
    }
    else if(colour === "GREEN") {
        return "<span style='float:right;color:green'>$" + (payAmount).toFixed(1) + "</span>";
    }
    else if(colour === "GOLD") {
        return "<span style='float:right;color:#aa6c39;'>$" + (payAmount).toFixed(1) + "</span>";
    }
}

/**
* Takes JSON format public holiday data from data.gov.au and populates
* windows.publicHolidays Array with correctly formatted holiday data.
* @param {object} holidays : An Array of JSON strings
*/
async function parseHolidays(holidays) {
    var formattedDate, eventName;
    for(var i = 0; i < holidays.length; i++) {
        // Converts data.gov.au date into aero-suitable form e.g. (20200101 -> 01/01)
        formattedDate = formatDate(holidays[i].Date);
        // Get the name of the public holiday event e.g. 'New Year's Day'
        eventName = holidays[i]["Holiday Name"];

        window.publicHolidays.push([formattedDate, eventName]);
    }
}

/**
* Change a given date string into a format compatible with the Aeronet 
* rostering format e.g. (20200101 -> 01/01/2020).
* @param {string} date : he date string to be converted
* @return {string} : An appropriately formatted date string.
*/
function formatDate(date) {
    var month = date.substring(4,6);
    var day = date.substring(6,9);
    var year = date.substring(0,4);
    return day + "/" + month + "/" + year;
}

/**
* Determines whether the specified date is a public holiday
* @param {String} date : The date to test for public holiday status.
* @return {String} : The name of the public holiday event on that day, undefined otherwise.
*/
function isPublicHoliday(date) {
    for(var i = 0; i < window.publicHolidays.length; i++) {
        // If this date is also found in the array of public holiday dates
        if(date === window.publicHolidays[i][0]) {
            return window.publicHolidays[i][1];
        }
    }
    return undefined;
}

/**
* Returns the applicable pay rate for a given day
* @param {string} date : A three character string specifying the day, e.g. 'Mon', 'Tue', etc...
* @return {int} : Applicable pay rate
*/
function getPayRate(day) {
    switch(day) {
        case "Sat":
            return window.satRate;
        break;
        case "Sun":
            return window.sunRate;
        break;
        default:
            return window.weekRate;
    }
}

/**
* Determines the current page within the content frame
* @param {Object} frameContent : The current page type that the user is viewing i.e Roster/Timesheet etc.
* @return {String} : The simplified name of the page in the iframe (#content_frame). 
*/
function getCurrentPage(frameContent) {
    if(/\bShifts for [a-zA-Z0-9]+\.[a-zA-Z0-9]+/g.test(frameContent.title)) {
        return getSelectedTab(frameContent);
    } else if(/\bTimesheet for [a-zA-Z0-9]+\.[a-zA-Z0-9]+/g.test(frameContent.title)) {
        return "Timesheet";
    } 
    return undefined;
}

/**
* Determines the currently selected tab on the roster page (i.e. "My Shifts", "Available", "Accept Swap")
* @param {Object} frameContent : The current page type that the user is viewing i.e Roster/Timesheet etc.
* @return {String} : The name of the tab which the user has currently selected.
*/
function getSelectedTab(frameContent) {
    var tabs = frameContent.getElementById("main-content").getElementsByClassName("dynamic-tab-pane-control")[0];
    var selectedTab = tabs.getElementsByClassName("tab-row")[0].getElementsByClassName("selected")[0].innerText;
    return selectedTab;
}

/**
* Returns the year of the roster/timesheet period that is being viewed by the user.
* This data is used to give appropriate public holiday predictions
*
* @param {Object} frameContent : The data within the frame which the user is currently viewing
* @param {String} page : The current page type that the user is viewing i.e Roster/Timesheet etc.
* @return {String} : Containing the year which is in view to the user. 
*/
function getYearFromContent(frameContent, page) {
    var weekSelectBox;
    if(page === "Roster") {
        var weekSelectBox = frameContent.getElementById("main-content").getElementsByClassName("formArea")[0].getElementsByTagName("select")[0];
    } else if(page === "Timesheet") {
        var weekSelectBox = frameContent.getElementById("main-content").getElementsByClassName("formAreaTitle")[0].getElementsByTagName("select")[0];      
    }

    var yearInView = weekSelectBox.selectedOptions[0].value.substring(0,4);

    // Return this year if failure.
    return (yearInView ? yearInView : Date().getFullYear());
}

/**
* Get stored rates which have been entered by the user 
* from the data synchronised with the user's Google account.
*/
async function getStoredRates() {
    chrome.storage.sync.get('rates', function(obj) {
        // If settings have been configured,
        if(obj.rates[0] && obj.rates[1] && obj.rates[2]) {
            window.weekRate = obj.rates[0];
            window.satRate = obj.rates[1];
            window.sunRate = obj.rates[2];
            window.state = obj.rates[3];

            window.settingsValid = 1;
        } else {
            console.log("AeroPay: Settings invalid. Check the top right.");
        }       
    });
}

/**
* Find public holidays for this year, next year and last year for the state 
* selected by the user. The data is sourced from data.gov.au.
*/
async function getHolidayData() {
    var nextYear = new Date().getFullYear() + 1;

    // The ID of this years public holiday file
    var holidayRecordIDs = [];

    // Search data.gov.au public holiday CSV repository for this years CSV
    $.getJSON('https://data.gov.au/api/3/action/package_show?id=b1bc6077-dadd-4f61-9f8c-002ab2cdff10', function(data) {
        // Find this, last and next years CSV files 
        for(var i = 0; i < data.result.resources.length; i++) {
            var selectedFile = data.result.resources[i].name;

            if(selectedFile === "Australian Public Holidays " + (nextYear - 0).toString()) {
                holidayRecordIDs[0] = data.result.resources[i].id;
            }
            else if(selectedFile === "Australian Public Holidays " + (nextYear - 1).toString()) {
                holidayRecordIDs[1] = data.result.resources[i].id;
            }
            else if(selectedFile === "Australian Public Holidays " + (nextYear - 2).toString()) {
                holidayRecordIDs[2] = data.result.resources[i].id;
            }
        }
    }).then(function() {
        // Get JSON data for this years public holiday data in the selected state
        for(var i = 0; i < 3; i++) {
            $.getJSON('https://data.gov.au/data/api/3/action/datastore_search?resource_id=' + holidayRecordIDs[i] + '&q=' + window.state, function(data) {
                parseHolidays(data.result.records)
            });
        }
    }); 
}

/**
* Displays a pretty message in console log
*/
function moo() {
	var msg = 
 `                        _____            
     /\\                 |  __ \\           
    /  \\   ___ _ __ ___ | |__) |_ _ _   _ 
   / /\\ \\ / _ \\ '__/ _ \\|  ___/ _' | | | |
  / ____ \\  __/ | | (_) | |  | (_| | |_| |
 /_/    \\_\\___|_|  \\___/|_|   \\__,_|\\__, |
                                     __/ |
                                    |___/ `;

	console.log("%c%s\n%c%s\n%c%s", "color: green; font-size: 12px;", msg,
                "color:green;font-size:9px;", "Public holiday data sourced from www.data.gov.au.",
                "color:#aa6c39;font-size:7px;", "By: Isaiah Simeone (V1.0)");

}

moo();