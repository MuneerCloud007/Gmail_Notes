document.getElementsByClassName("authBtn")[0].addEventListener("click", async()=>{

  let data=await chrome.runtime.sendMessage({message:"api_code"})
  console.log(data)
  
  

})




document.getElementsByClassName("authLogout")[0].addEventListener("click", function(){
  chrome.runtime.sendMessage({message:"log_out"})
})


