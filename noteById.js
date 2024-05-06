//<textarea class="sgn_input" style="color: rgb(82, 82, 82); height: 73.2px; background-color: rgb(199, 217, 194);"></textarea>
const url = 'https://www.googleapis.com/upload/drive/v3/files';
let loginData = false;
let accessToken = "";
let intervalId;
let textAreaContent = "";
let FolderName = "Gmail_Notes"
let textBoxContent = "";
let folderId;
let fileId;
let mailByIdContent;

const loadById = async () => {
    // Create a div element
    const createDiv = document.createElement("div");
    createDiv.classList.add("sgn_container", "sgn_position_top");
    createDiv.setAttribute("data-note-position", "top");
    createDiv.style.width = "auto";
    console.log("loginData = " + loginData);
    console.log("accessToken = " + accessToken)
    let textBoxContent = "";
    folderId = null;
    fileId = null;
    var messageIdElement = document.querySelector('[data-message-id]');
     mailByIdContent=document.querySelector(".ha").firstElementChild.textContent+"";
     let messageId = messageIdElement.getAttribute('data-legacy-message-id')+" - "+mailByIdContent;



    if (loginData && accessToken) {
        console.log("I am above findFOlderID")

        folderId = await findFolderId(FolderName);
        console.log(folderId);
        console.log("I am below findFOlderID")
        if (folderId) {
            console.log("I am folderId True")
            fileId = await fetchFileByNameInFolder(messageId, folderId);
            if (fileId) {
                console.log("I am FileId true")
                textBoxContent = await fetchFileContent(fileId);
            }
        }



        createDiv.innerHTML = `
    <div class="sgn_padding" style="display: none;">&nbsp;<div></div></div>
    <div class="sgn_prompt_logout" style=""><a target="_blank" class="sgn_bart_logo_top" href="https://www.bart.com.hk/?from=c-ed-n">
    <img title="Powered By Bart Solutions" src="https://static-gl.simplegmailnotes.com/media/bart-logo.24.png?v=2.8.30.0&amp;from=c-ed-n"></a>
    <a class="sgn_action sgn_current_connection" href="https://drive.google.com/drive/folders/1yRksxq7faGDiroJkTayDc0Ci9b2eofBJ" style="display: none;">SGN: <span class="sgn_user">muneer@cloudvandana.com</span></a>
     <a class="sgn_logout sgn_action sgn_button"><img title="Log Out (muneer@cloudvandana.com)" src="chrome-extension://jfjkcbkgjohminidbpendlodpfacgmlm/image/logout.24.png"></a>
     <a class="sgn_action sgn_delete sgn_button" target="_blank"><img title="Delete" src="chrome-extension://jfjkcbkgjohminidbpendlodpfacgmlm/image/delete.24.png"></a> 
     <a class="sgn_action sgn_add_calendar sgn_button" target="_blank" href="https://calendar.google.com/calendar/b/0/render?action=TEMPLATE&amp;text=Re%3A%20Mailtrack%20Daily%20Report%20Apr%2030%2C%202024%3A%201%20email%20sent&amp;details=https%3A%2F%2Fmail.google.com%2Fmail%2Fu%2F0%2F%23all%2F18f31ab14dc6d19e%0A-----%0A">
     <img title="Add to Google Calendar" src="chrome-extension://jfjkcbkgjohminidbpendlodpfacgmlm/image/calendar.24.png"></a> <a class="sgn_action sgn_modal_list_notes sgn_button" target="_blank"> <a class="sgn_action sgn_color_picker sgn_background_color sgn_button"><input type="hidden" class="sgn_color_picker_value" value="" style="display: none;"><div class="simpleColorContainer" style="position: relative;">
     <div class="simpleColorDisplay" style="background-color: rgb(255, 255, 255); border: 1px solid rgb(0, 0, 0); width: 115px; height: 20px; cursor: pointer;"></div></div></a>
      <a class="sgn_action sgn_color_picker sgn_button"></a><a class="sgn_action sgn_template sgn_button" style="margin-left: 10px; display: none;"><img title="Template" style="width:20.5px; height:23px;" src="chrome-extension://jfjkcbkgjohminidbpendlodpfacgmlm/image/template.png"></a>
      
       <div class="sgn_textarea_container"><textarea class="sgn_input" style="color: rgb(82, 82, 82); height: 73.2px; background-color: rgb(255, 255, 153);" ></textarea></div>

  `;
    }
    else {

        createDiv.innerHTML = `<div class="sgn_container_login sgn_position_top" data-note-position="top" style="width: auto;"><div class="sgn_padding" style="display: none;">&nbsp;<div>
</div></div>
<div class="sgn_prompt_logout" style="display: none;"><a target="_blank" class="sgn_bart_logo_top" href="https://www.bart.com.hk/?from=c-ed-n"><img title="Powered By Bart Solutions" src="https://static-gl.simplegmailnotes.com/media/bart-logo.24.png?v=2.8.30.0&amp;from=c-ed-n"></a><a class="sgn_action sgn_current_connection" href="https://drive.google.com/drive/folders/" style="display: none;">SGN: <span class="sgn_user"></span>
</a> <a class="sgn_logout sgn_action sgn_button"><img title="Log Out ()" src="chrome-extension://jfjkcbkgjohminidbpendlodpfacgmlm/image/logout.24.png"></a><a class="sgn_open_options sgn_action sgn_button"><img title="Preferences" src="chrome-extension://jfjkcbkgjohminidbpendlodpfacgmlm/image/preferences.24.png"></a><a class="sgn_action sgn_delete sgn_button" target="_blank"><img title="Delete" src="chrome-extension://jfjkcbkgjohminidbpendlodpfacgmlm/image/delete.24.png"></a>
 <a class="sgn_action sgn_add_calendar sgn_button" target="_blank" href="https://calendar.google.com/calendar/b/0/render?action=TEMPLATE&amp;text=Re%3A%20Just%20launched%3A%20AWS%20re%3AInforce%20session%20catalog&amp;details=https%3A%2F%2Fmail.google.com%2Fmail%2Fu%2F0%2F%23all%2F18f36e71887a2dc8%0A-----%0A">
 <img title="Add to Google Calendar" src="chrome-extension://jfjkcbkgjohminidbpendlodpfacgmlm/image/calendar.24.png"></a> <a class="sgn_action sgn_modal_list_notes sgn_button" target="_blank"></a>
  <a class="sgn_action sgn_color_picker sgn_background_color sgn_button"><input type="hidden" class="sgn_color_picker_value" value="" style="display: none;"><div class="simpleColorContainer" style="position: relative;"><div class="simpleColorDisplay" style="background-color: rgb(255, 255, 255); border: 1px solid rgb(0, 0, 0); width: 115px; height: 20px; cursor: pointer;"></div></div> <a class="sgn_action sgn_color_picker sgn_button"></a><a class="sgn_action sgn_template sgn_button" style="margin-left: 10px; display: none;"><img title="Template" style="width:20.5px; height:23px;" src="chrome-extension://jfjkcbkgjohminidbpendlodpfacgmlm/image/template.png"></a> <a class="sgn_share sgn_action sgn_button"><img class="sgn_share_img" title="Login CRM / Sync to mobile" src="chrome-extension://jfjkcbkgjohminidbpendlodpfacgmlm/image/share.24.png"></a><a class="sgn_open_opportunity sgn_action"><div class="sgn_opp_name"></div></a><div class="sgn_notice sgn_cutom"></div></div><div class="sgn_prompt_login" style="">Please <a class="sgn_login sgn_action" onclick="loginBtn()">login</a> your Google Drive to start using Simple Gmail Notes</div>
  <div class="sgn_textarea_container"><textarea class="sgn_input" disabled="" style="color: rgb(82, 82, 82); height: 73.2px;"></textarea><div class="sgn_note_timestamp sgn_is_hidden"><img alt="note timestamp" src="chrome-extension://jfjkcbkgjohminidbpendlodpfacgmlm/image/note-timestamp.png"><span class="sgn_note_timestamp_content"></span></div></div><div class="sgn_crm_prompt"></div><div class="sgn_error sgn_crm" style="display: none;"></div><div data-initial-value="*error*" class="sgn_error sgn_custom" style="display: none;">*error*</div><div class="sgn_error sgn_login" style="display: none;">Failed to login Google Drive: *error*<br><span class="sgn_alternate_login">If the problem persists, please try the <a class="sgn_login_sgn_web sgn_action">alternate login</a>.</span></div><div class="sgn_error sgn_user" style="display: none;">Failed to get Google Driver User</div><div class="sgn_error sgn_revoke_crm" style="display: none;">Error found with the CRM token. Please click the share button again to re-login Simple Mobile CRM. 
If error persists, you may try to manually <a href="https://accounts.google.com/b/0/IssuedAuthSubTokens">revoke</a> previous CRM tokens first.</div><div class="sgn_error sgn_revoke" style="display: none;">Error found with the existing token. Please try to <a class="sgn_reconnect sgn_action">connect</a> again. 
If error persists, you may try to manually <a href="https://accounts.google.com/b/0/IssuedAuthSubTokens">revoke</a> previous tokens first.</div><a target="_blank" class="sgn_bart_logo_bottom" href="https://www.bart.com.hk/?from=c-ed-n"><img title="Powered By Bart Solutions" src="https://static-gl.simplegmailnotes.com/media/bart-logo.24.png?v=2.8.30.0&amp;from=c-ed-n"></a></div>`

    }






    //onChange method  for text area
    const parentElement = document.getElementsByClassName("nH g id")[0].children[1];



    // Insert the created div before the second child of the parent element
    parentElement.insertBefore(createDiv, parentElement.children[1]);

    const sgnInputs = document.getElementsByClassName("sgn_input");
    console.log(sgnInputs)
    if (sgnInputs.length > 0) {
        if (fileId && folderId && textBoxContent.length > 0) {

            sgnInputs[0].value = textBoxContent;

        }
        sgnInputs[0].addEventListener("change", async (e) => {

            //IF folder or file is not present this code will run
            
            console.log(e.target.value)
            folderId = await findFolderId(FolderName);
        let fileUpload=null;
        let fileUpdate=null;
        


            if (!folderId) {
                const folder = await createFolder();
                if (!fileId) {
                    fileUpload=await uploadFile(folder.id, e.target.value, messageId);

                }

            }
            else {
                console.log(fileId)
                if (!fileId) {
                    fileUpload=await uploadFile(folderId, e.target.value, messageId);

                }
                if(fileId) {
                    console.log("I am here");
                    fileUpdate=await updateFileContent(fileId,e.target.value);
                }
            }
            console.log(fileId)
            console.log(fileUpload);
            if(fileUpdate) {
                sgnInputs[0].value = e.target.value;
                fileUpdate=null;

                return alert("File has been updated");

            }
            if(fileUpload) {
                sgnInputs[0].value = e.target.value;
                fileId=fileUpload.id;
                 fileUpload=null;
            return alert("File has been created");
            }




        });
    }
    document.querySelector(".sgn_login")?.addEventListener("click", async () => {
        //  chrome.runtime.sendMessage({message:"log_out"})

        chrome.runtime.sendMessage({ message: "auth_code" }, async (respose) => {

            const { auth_token } = await chrome.storage.local.get("auth_token");
            console.log(auth_token);

            intervalId = setInterval(async () => {
                const { auth_token } = await chrome.storage.local.get("auth_token");

                if (auth_token) {
                    clearInterval(intervalId);

                    console.log("Access token obtained:", auth_token);
                    loginData = true;
                    accessToken = auth_token;


                    createDiv.remove();
                    if (!document.getElementsByClassName("sgn_container").length > 0) {

                    loadById();
                    }

                }
                console.log("SETINTERVAL WORKING AAAA");
                console.log(auth_token);
            }, 5000);

        })





    })

    document.querySelector(".sgn_logout")?.addEventListener("click", async () => {
        accessToken = "";
        console.log("I am in logout btn");
        loginData = false;
        await chrome.storage.local.get("log_out")
        createDiv.remove();

        loadById();

    })
    document.getElementsByClassName("sgn_delete")[0].addEventListener("click", async () => {
        if(!folderId){
            folderId = await findFolderId(FolderName);

        }
        fileId = await fetchFileByNameInFolder(messageId, folderId);

        if (!fileId) {
            return window.alert("Please enter something !!!");
        }
        else {
            const resp = await deleteFile(fileId);
            console.log(resp);
            sgnInputs[0].value = "";
            fileId=null;


            alert("File has been deleted");
        }


    })


}



chrome.runtime.onMessage.addListener(message => {
    console.log("Message on runtime");
    console.log(message);
    if (message && message.message === 'ScriptsInjected') {
        if (document.getElementsByClassName("nH g id").length > 0) {

            if (!document.getElementsByClassName("sgn_container").length > 0) {


                console.log('sgn_container');
                console.log(document.getElementsByClassName("sgn_container"));




                loadById();

            }


        }
    }

});



const createFolder = async () => {
    const url = 'https://www.googleapis.com/upload/drive/v2/files';
    const uploadType = 'multipart';

    const folderMetadata = {
        title: "Gmail_Notes",
        mimeType: 'application/vnd.google-apps.folder'
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(folderMetadata)], { type: 'application/json' }));

    try {
        const response = await fetch(`${url}?uploadType=${uploadType}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
            body: formData
        });

        if (!response.ok) {
            const errorMessage = await response.json();
            throw new Error(errorMessage.error.message);
        }

        const folder = await response.json();
        console.log('Folder created:', folder);
        return folder;
    } catch (error) {
        console.error('Error creating folder:', error);
        throw error;
    }
};

const uploadFile = async (folderId, fileContent, messageId) => {
    const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    const fileMetadata = {
        name: messageId,
        parents: [folderId] // Specify the folder ID as the parent
    };


    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
    formData.append('file', new Blob([fileContent], { type: 'text/plain' }));

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
            body: formData
        });

        if (!response.ok) {
            const errorMessage = await response.json();
            throw new Error(errorMessage.error.message);
        }

        const uploadedFile = await response.json();
        console.log('File uploaded:', uploadedFile);
        return uploadedFile;
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
};





const fetchFileByNameInFolder = async (messageId, parentFolderId) => {
    try {
        const url = `https://www.googleapis.com/drive/v3/files?q=name='${messageId}'+and+'${parentFolderId}'+in+parents`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            }
        });

        if (!response.ok) {
            const errorMessage = await response.json();
            throw new Error(errorMessage.error.message);
        }

        const data = await response.json();
        if (data.files.length === 0) {
            return false;
        }

        const file = data.files[0].id; // Assuming unique file names within folders
        console.log('File found:', file);
        return file;
    } catch (error) {
        console.log(error)
        console.error('Error getting file by name in folder:', error);
        throw error;
    }
};


async function fetchFileContent(fileId) {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            }
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.text(); // Assuming the content is text/plain, use response.blob() if it's binary
        return data;
    } catch (error) {
        console.error('Error fetching file content:', error);
        console.log(error);
    }
}

async function deleteFile(fileId) {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;

    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            }
        });

        if (!response.ok) {
            throw new Error('Failed to delete file');
        }
        console.log('File deleted successfully');

        return response;

    } catch (error) {
        console.error('Error deleting file:', error);

    }
}
async function findFolderId(folderName) {
    const url = `https://www.googleapis.com/drive/v3/files`;
    const query = `q=name='${encodeURIComponent("Gmail_Notes")}'+and+mimeType='application/vnd.google-apps.folder'`;

    try {
        const response = await fetch(`${url}?${query}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            }
        });

        if (!response.ok) {
            throw new Error('Failed to find folder ID');
        }

        const responseData = await response.json();
        const folders = responseData.files;

        if (folders.length === 0) {
            return false;
        }

        return folders[0].id;
    } catch (error) {
        console.error('Error finding folder ID:', error);
    }
}

// Function to update file content in Google Drive
async function updateFileContent(fileId, newContent) {
    const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;

    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'text/plain'
    };

    const options = {
        method: 'PATCH',
        headers: headers,
        body: newContent
    };

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`Failed to update file content: ${response.statusText}`);
        }
        console.log('File content updated successfully.');
        return response;
    } catch (error) {
        console.error('Error updating file content:', error);
    }
}


































