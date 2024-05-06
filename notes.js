let FolderId;
let apiToken;
let FileLists;
let dataLoaded=false;



// Function to load and initialize the injection process
const load = async () => {
    // Check if the target element is present and ready for injection
    if (document.getElementsByClassName("D E G-atb")[0]?.children[0]) {
        // Request API token from the background script
        await chrome.runtime.sendMessage({ message: "api_code" });

        // Retrieve API token from local storage
        const { api_token } = await chrome.storage.local.get("api_token");
        apiToken = api_token;
        console.log(apiToken);


        

        FolderId = await folderIdApiKey(apiToken);
        console.log(FolderId);



        // Inject main elements if not already injected
        await injectMainElements();


        // Inject additional elements for each file
        setTimeout(async()=>{
            if(document.querySelectorAll(".Added_Div").length>0) {
            document.querySelectorAll(".Added_Div")?.forEach((vl)=>{vl.remove()})
            }
            await injectFileElements();

        },[5000])







    }
};

// Function to inject main elements
const injectMainElements = async () => {

    FileLists = await listFilesApiKey(FolderId, apiToken);
    console.log("injectMainElements");
    console.log(FileLists);
    FileLists.map(async (value) => {
        value.content = await fetchFileContentById(value.id);

    })

    let newDiv = document.createElement("div");
    let newImg = document.createElement("img");

    newImg.src = "chrome-extension://jfjkcbkgjohminidbpendlodpfacgmlm/image/icon.24.png";

    newDiv.classList.add("mail_modal");
    newDiv.classList.add("G-Ni")
    newDiv.classList.add("J-J5-Ji")
    newDiv.setAttribute("data-toggle", "modal");
    newDiv.setAttribute("data-target", "#exampleModalCenter");

    newDiv.appendChild(newImg);

    let parentElement = document.getElementsByClassName("D E G-atb")[0].children[0].children[0].children[0].children[0];


    parentElement.append(newDiv);

    const mailSearchElement = document.querySelector(".mail_modal");
    mailSearchElement.addEventListener("click", async () => {
        await createModal(FileLists)
        const searchInput = document.querySelector(".sgn-modal-input");
        searchInput?.addEventListener("input", async (e) => {
            if (!FileLists) {
                FileLists = await listFilesApiKey(FolderId, apiToken);
                console.log("injectMainElements");
                console.log(FileLists);
                FileLists.map(async (value) => {
                    value.content = await fetchFileContentById(value.id);

                })
            }
            const searchTerm = e.target.value.trim().toLowerCase();
            let filteredFiles;
            if (searchTerm.length==0) {
                console.log(FileLists);
                filteredFiles = [...FileLists];
                console.log(filteredFiles);
            } else {
                FileLists = [...FileLists];
                if(!FileLists[0]["content"]){
                        FileLists.map(async (value) => {
                            value.content = await fetchFileContentById(value.id);
        
                        })
                    }
                
                filteredFiles = FileLists.filter((vl) => {
                    const { name, content } = vl;
                   
                    return name.toLowerCase().includes(searchTerm) || content.toLowerCase().includes(searchTerm);
                });
            }
            console.log(filteredFiles);
            document.querySelector("#customers>tbody")
                .innerHTML = "";
            // Populate the table with filtered data
            filteredFiles.forEach((data) => {
                const row = document.createElement("tr");
                row.classList.add("row");
                const { name, content, id } = data;
                const td1 = document.createElement("td");
                td1.textContent = name;
                const td2 = document.createElement("td");
                td2.textContent = content;
                const td3 = document.createElement("td");
                td3.textContent = "Delete";
                td3.id = id;
                td3.classList.add("delete");
                row.appendChild(td1);
                row.appendChild(td2);
                row.appendChild(td3);
                row.addEventListener("click", async (e) => {
                    if (td3.classList.contains("delete")) {
                        RecursiveDeleteById(e.target.id, document.querySelector("#customers>tbody")
                        );
                    }
                });
                document.querySelector("#customers>tbody")
                    .appendChild(row);

            });
        });






    }, true);


};

// Function to inject elements for each file
const injectFileElements = async () => {
    const divMap = {};

    FileLists = await listFilesApiKey(FolderId, apiToken);
    console.log("INJECTED IN FILE ELEMENT I AM SECOND FUNCTION");
    console.log(FileLists);
   


    FileLists.forEach(async(vl) => {
        const targetId = vl.name.split("-")[0].trim();
        const name=vl.name.split("-")[1].trim();


        console.log("Target ID value:", targetId);

        // Check if element is already injected for this file
        if (!divMap[targetId]) {
            let newDiv = document.createElement('div');

            newDiv.textContent =`[${await fetchFileContentById(vl.id)}]`;
            newDiv.style.backgroundColor = "yellow";
            newDiv.classList.add("Added_Div")

            divMap[targetId] = newDiv;

            const spanElements = document.querySelectorAll('span');

            // Find the corresponding <span> element and insert the new <div> element after its parent <div>
            spanElements.forEach(spanElement => {
                const messageId = spanElement.getAttribute('data-legacy-last-non-draft-message-id');
                if (messageId === targetId && spanElement.parentElement.parentElement.tagName === "DIV") {
                    spanElement.classList.add("hello")
                     console.log(spanElement.parentElement);
                     if (spanElement.parentElement.nextSibling?.className == "Added_Div") {
                         spanElement.parentElement.nextSibling.remove();
                     }
                    spanElement.parentElement.parentElement.insertAdjacentElement('afterend', newDiv);
                }
            });
        }
    });
};

// Function to fetch folder ID using API token
async function folderIdApiKey(apiToken) {
    const url = `https://www.googleapis.com/drive/v3/files`;
    const query = `q=name='${encodeURIComponent("Gmail_Notes")}'+and+mimeType='application/vnd.google-apps.folder'`;

    console.log(apiToken);

    try {
        const response = await fetch(`${url}?${query}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
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
        return null;
    }
}

// Function to fetch list of files using folder ID and API token
async function listFilesApiKey(folderId, apiToken) {
    const apiUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&trashed=false`;

    try {
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${apiToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch files');
        }

        const data = await response.json();
        return data.files;
    } catch (error) {
        console.error('Error fetching files:', error);
        return [];
    }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(message => {
    if (message && message.message === 'ScriptsInjected') {
        // Check if the target element exists and initiate the loading process
        if (document.getElementsByClassName("D E G-atb").length > 0) {
            if (!document.getElementsByClassName("mail_modal").length > 0 && location.href=="https://mail.google.com/mail/u/0/#inbox")  {
                load();
            }
            else if(location.href=="https://mail.google.com/mail/u/0/#inbox"){
if(!dataLoaded){
    dataLoaded=true;

                setTimeout(async()=>{
                    if(document.querySelectorAll(".Added_Div").length>0) {
                    document.querySelectorAll(".Added_Div")?.forEach((vl)=>{vl.remove()})
                    }
                    await injectFileElements();
                    dataLoaded=false;
        
                },[2000])
            }
        }
        }
    }
});

const createModal = async () => {
    let modal;
    let modalContent;
    let modalHeader;
    FileLists = await listFilesApiKey(FolderId, apiToken);
    
    FileLists.map(async (value) => {
        value.content = await fetchFileContentById(value.id);

    })


    modal = document.createElement("div");
    modal.classList.add("modal");
    modalContent = document.createElement("div");
    modalContent.classList.add("modal-content");
    modalHeader = document.createElement("div");
    modalHeader.classList.add("modal-header");

    modalHeader.innerHTML = `<div class="sgn-header-menu">
    <div class="sgn-modal-title-contain"><div class="sgn-modal-title">Gmail Notes
    </div>
    <div class="sgn-modal-subtitle"><img src="https://static-gl.simplegmailnotes.com/media/bart-logo.24.png?v=2.9.0.1&amp;from=c-s-n">
    </div>
    </div>
    <div id="sgn-modal-search-div" class="sgn-modal-search"><div class="sgn-modal-search">
            <input class="sgn-modal-input" type="text" placeholder="Search" style="background-image: url(&quot;chrome-extension://jfjkcbkgjohminidbpendlodpfacgmlm/image/search.24.png&quot;);"><div class="sgn-googledrive-folder"><a href="https://drive.google.com/drive/folders/1yRksxq7faGDiroJkTayDc0Ci9b2eofBJ"><img src="chrome-extension://jfjkcbkgjohminidbpendlodpfacgmlm/image/Google-Drive-icon.png" alt="google drive folder url"></a></div></div></div>
           
            </div>`;



    let modalBody = document.createElement("div");
    modalBody.classList.add("modal-body");

    const table = document.createElement("table");
    table.id = "customers";
    let count=1;

    const headerRow = document.createElement("tr");
    ["Email", "NAME", "Delete"].forEach(text => {
        const th = document.createElement("th");
        th.textContent = text;
        th.classList.add(`th-${count}`)
        count++;
        headerRow.appendChild(th);
    });

    table.appendChild(headerRow);

    let tbody = document.createElement("tbody");
    FileLists.forEach(async (rowData) => {
        const row = document.createElement("tr");
        row.classList.add("row");
        const { name, content, id } = rowData;
        const td1 = document.createElement("td");
        td1.textContent = name;
        const td2 = document.createElement("td");
        td2.textContent = await fetchFileContentById(id);
        const td3 = document.createElement("td");
        td3.textContent = "Delete";
        td3.id = id;
        td3.classList.add("delete");
        row.appendChild(td1);
        row.appendChild(td2);
        row.appendChild(td3);
        row.addEventListener("click", async (e) => {
            console.log(e.target);
            if (e.target.classList.contains("delete")) {
                RecursiveDeleteById(e.target.id, document.querySelector("#customers>tbody"));
            }
        });
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    modalBody.appendChild(table);

    let modalFooter = document.createElement("div");
    modalFooter.classList.add("modal-footer");
    modalFooter.innerHTML = `<h3>Modal Footer</h3>`;

    const crossDiv = document.createElement("div");
    const crossSpan = document.createElement("span");
    crossSpan.textContent = "X";
    crossSpan.classList.add("close");
    crossDiv.append(crossSpan);
    modalContent.appendChild(crossDiv);

    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modal.appendChild(modalContent);

    let parentElement = document.getElementsByClassName("nH")[0];
    parentElement.appendChild(modal);

    let span = document.querySelector(".close");

    // const searchInput = modalHeader.querySelector(".sgn-modal-input");
    // searchInput.addEventListener("input", (e) => {
    //     const searchTerm = e.target.value.trim().toLowerCase();
    //     let filteredFiles;
    //     if (searchTerm === "") {
    //         filteredFiles = [...rowData];
    //     } else {
    //         filteredFiles = rowData.filter((vl) => {
    //             const { name, content } = vl;
    //             return name.toLowerCase().includes(searchTerm) || content.toLowerCase().includes(searchTerm);
    //         });
    //     }
    //     console.log(filteredFiles);
    //     tbody.innerHTML = "";
    //     // Populate the table with filtered data
    //     filteredFiles.forEach((data) => {
    //         const row = document.createElement("tr");
    //         row.classList.add("row");
    //         const { name, content, id } = data;
    //         const td1 = document.createElement("td");
    //         td1.textContent = name;
    //         const td2 = document.createElement("td");
    //         td2.textContent = content;
    //         const td3 = document.createElement("td");
    //         td3.textContent = "Delete";
    //         td3.id = id;
    //         td3.classList.add("delete");
    //         row.appendChild(td1);
    //         row.appendChild(td2);
    //         row.appendChild(td3);
    //         row.addEventListener("click", async (e) => {
    //             if (td3.classList.contains("delete")) {
    //                 RecursiveDeleteById(e.target.id, tbody);
    //             }
    //         });
    //         tbody.appendChild(row);
    //     });
    // });

    span.onclick = function () {
        parentElement.removeChild(modal);
    };

    window.onclick = function (event) {
        if (event.target == modal) {
            parentElement.removeChild(modal);
        }
    };
};



async function RecursiveDeleteById(id, oldtbody) {
    oldtbody.remove();

    await deleteRowByIdApi(id);
    const rowData = await listFilesApiKey(FolderId, apiToken);
    console.log("LIST OF FILES");
    console.log(rowData);
    rowData.map(async (value) => {
        value.content = await fetchFileContentById(value.id);

    })

    FileLists = [...rowData];
    let tbody = document.createElement("tbody")
    rowData.forEach(async (data) => {
        const row = document.createElement("tr");
        row.classList.add("row");
        const { name, content, id } = data;
        console.log(data["content"]);
        console.log(data);
        let nameArr = name.split("-");
        let id1 = nameArr[1];

        const td1 = document.createElement("td");
        td1.textContent = data["name"];
        const td2 = document.createElement("td");
        td2.textContent = await fetchFileContentById(id);
        const td3 = document.createElement("td");
        td3.textContent = "Delete"
        td3.id = id;
        td3.classList.add("delete")

        row.appendChild(td1);
        row.appendChild(td2);
        row.appendChild(td3);
        row.addEventListener("click", async (e) => {
            if (td3.classList.contains("delete")) {
                return RecursiveDeleteById(e.target.id, tbody);
            }

        })
        tbody.appendChild(row);

    })
    setTimeout(async()=>{
        if(document.querySelectorAll(".Added_Div").length>0) {
            document.querySelectorAll(".Added_Div")?.forEach((vl)=>{vl.remove()})
            }
        await injectFileElements();

    },[4000])

    document.getElementById("customers").appendChild(tbody);

}

async function fetchFileContentById(fileId) {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
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


async function deleteRowByIdApi(fileId) {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;

    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
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