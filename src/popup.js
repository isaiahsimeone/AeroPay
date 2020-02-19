function validate(str) {
    var pattern = /^[0-9]*\.?[0-9]*$/;
    return str.match(pattern);
}

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
