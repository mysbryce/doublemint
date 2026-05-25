import { Process } from "mint:process";
import { println } from "mint:io";

export function main(): void {
  let mainHwnd: int64 = Process.findWindowByClass("Notepad");
  if (mainHwnd == 0) {
    println("notepad.exe window not found (looking for class Notepad).");
    println("note: this targets classic notepad.exe — Windows 11 store Notepad uses WinUI and does not respond to SendMessage(WM_GETTEXT).");
    return;
  }

  println("found Notepad hwnd=", mainHwnd);

  let editHwnd: int64 = Process.findChildWindow(mainHwnd, "Edit");
  if (editHwnd == 0) {
    println("Edit child control not found.");
    return;
  }

  println("found Edit hwnd=", editHwnd);

  let content: string = Process.getWindowText(editHwnd);
  println("---- notepad content begin ----");
  println(content);
  println("---- notepad content end ----");
}
