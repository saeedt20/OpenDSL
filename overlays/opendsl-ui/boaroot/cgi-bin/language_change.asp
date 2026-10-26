<%
if request_Form("preferred_lang") <> "" then
           tcWebApi_set("LanguageSwitch_Entry","Type","preferred_lang")
           tcWebApi_commit("LanguageSwitch_Entry")
end if
%>
<html xmlns="http://www.w3.org/1999/xhtml">
<html xmlns:v>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<link rel="stylesheet" href="/opendsl/legacy.css" data-opendsl-theme="legacy">
<script defer src="/opendsl/legacy.js" data-opendsl-enhancement="legacy"></script>
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<script type="text/javascript">

function reloadpage(){
	if(navigator.appName.indexOf("Microsoft") >= 0)
		parent.parent.location.reload();
	else
		parent.parent.location.href = parent.parent.location.href.split('#')[0];
}

function initial() {
	setTimeout("reloadpage();", 2000);
}
</script>
<body onload="initial();">
</body>
</html>
