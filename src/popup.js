/**
* Validates whether a string is in the correct format to be saved, (e.g. 23.2, 26.43, etc)
* @Param {string} : The payrate to be validated
* @returns {boolean} : true if the string is properly formatted as a pay rate, false otherwise.
*/
function validate(str) {
    var pattern = /^[0-9]*\.?[0-9]*$/;
    return str.match(pattern);
}

/**
* Saves any changes made by the user upon any of the text fields (or option boxes) changing
*/
function rateChange() {
	var rateArray = [weekPay.value, satPay.value, sunPay.value, state.value];

	if(validate(rateArray[0]) && validate(rateArray[1]) && validate(rateArray[2])) {
		chrome.storage.sync.set({'rates' : rateArray}, function() {
			console.log("Saved Rates: "+rateArray);
		});
	} else {
		alert("Invalid Input. Changes not saved.");
	}
}

/**
* Executed upon load of popup.html when the user is attempting to access extension settings
* Payrates are fetched from the users account and prefilled into the pay rate text boxes.
*/
$(function() {
	var weekPay = document.getElementById("weekPay");
    var satPay = document.getElementById("satPay");
    var sunPay = document.getElementById("sunPay");
    var state = document.getElementById("state");

    document.getElementById("buttonChange").addEventListener("click", rateChange);

    // Get rates if they exist
    chrome.storage.sync.get('rates', function(obj) {
    	weekPay.value = obj.rates[0];
    	satPay.value = obj.rates[1];
    	sunPay.value = obj.rates[2];
        state.value = obj.rates[3];

		chrome.tabs.query({active:true,currentWindow: true}, function(tabs){
            chrome.tabs.sendMessage(tabs[0].id, {todo: "approximatePay", rates: obj.rates });
        });
    });
});
