/**
  * Sketchpad.scala - Opetopic Sketchpad Application
  * 
  * @author Eric Finster
  * @version 0.1 
  */

package opetopic.js.sketchpad

import scala.scalajs.{js => sjs}
import sjs.Dynamic.{literal => lit}
import scala.scalajs.js.JSApp
import org.scalajs.dom
import org.scalajs.dom._
import org.scalajs.jquery._
import scalatags.JsDom.all._

import scalajs.concurrent.JSExecutionContext.Implicits.queue

import opetopic._
import opetopic.ui._
import opetopic.js._
import mtl._

import JsDomFramework._
import JQuerySemanticUI._

object Sketchpad extends JSApp {

  val editor = new JsStableEditor[SimpleMarker]
  val viewer = new JsStableViewer[Option[SimpleMarker]]
  val frameViewer = new JsStableViewer[Option[SimpleMarker]]

  type EditorCell = editor.StableCell
  type FrameCell = frameViewer.CellType

  editor.onSelectAsRoot = (c: EditorCell) => {
    showRootFace
    showProps(c)
  }

  frameViewer.onSelectAsRoot = (c: FrameCell) => { 
    showDecoration
  }

  def main : Unit = {

    println("Launched Opetopic Sketchpad.")

    jQuery("#editor-div").append(editor.uiElement)
    editor.initialize

    jQuery("#viewer-div").append(viewer.uiElement)
    viewer.initialize

    jQuery("#edge-props").append(frameViewer.uiElement)
    frameViewer.initialize

    jQuery("#fill-color-btn").popup(lit(
      popup = jQuery(".color-select.popup"),
      movePopup = false,
      on = "click",
      onShow = () => { isFill = true }
    ))

    jQuery("#stroke-color-btn").popup(lit(
      popup = jQuery(".color-select.popup"),
      movePopup = false,
      on = "click",
      onShow = () => { isFill = false }
    ))

    jQuery("#dec-shape-btn").dropdown(lit(
      action = "hide",
      onChange = (shape: String) => {
        decShape = shape
        updateDecoration
      }
    ))

    jQuery("#dec-color-btn").dropdown(lit(
      action = "hide",
      onChange = (color: String) => {
        jQuery("#dec-color-btn").removeClass(decColor).addClass(color)
        decColor = color
        updateDecoration
      }
    ))

    jQuery("#label-input").on("input", () => { updateLabel })

    jQuery(".color-select.popup button").on("click", (e: JQueryEventObject) => {

      val color= jQuery(e.target).attr("data-color").toString

      if (isFill) {
        showFill(color)
        updateFillColor
      } else {
        showStroke(color)
        updateStrokeColor
      }

    })

    jQuery("#edge-accordion").accordion()

    jQuery("#saved-sketches .item").each((e: dom.Element) => {
      for {
        suuid <- jQuery(e).attr("data-id").toOption
      } {

        jQuery(e).on("click", () => {

          for { (_, old) <- selectedSketch } { 
            jQuery(old).removeClass("active") 
          }

          jQuery(e).addClass("active")
          selectedSketch = Some(suuid, e)

        })
        
      }
    })

    jQuery("#view-btn").on("click", () => { loadSelectedSketch })
    jQuery("#delete-btn").on("click", () => { deleteSelectedSketch })
    jQuery("#save-btn").on("click", () => { saveSketch })
    jQuery("#svg-btn").on("click", () => { renderSketch })
    jQuery("#export-btn").on("click", () => { exportSketch })

  }

  var isFill: Boolean = true
  var fillColor: String = "white"
  var strokeColor: String = "black"
  var selectedSketch: Option[(String, dom.Element)] = None

  var decColor: String = "black"
  var decShape: String = "none"

  def updateLabel: Unit = {

    import latex.LatexParser
    import fastparse.all._

    val inputVal = jQuery("#label-input").value().toString

    val labelVal = 
      LatexParser.Input.parse(
        inputVal
      ) match {
        case Parsed.Success(value, _) => value
        case Parsed.Failure(_, _, _) => inputVal
      }

    editor.updateLabel({
      case None => Some(SimpleMarker(labelVal))
      case Some(SimpleMarker(l, s, td, sd)) => Some(SimpleMarker(labelVal, s, td, sd))
    })

    showRootFace

  }

  def showDecoration: Unit = {
    println("Showing decoration ...")
  }

  def updateDecoration: Unit = {

    frameViewer.rootAction(fc => {
      editor.rootAction(ec => {
        println("Updating decoration...")

        if (fc.isExternal) {
          val dec = EdgeDecoration(decShape, decColor, false)
          val addr = fc.address.head.dir
          ec.label match {
            case None => ec.label = Some(SimpleMarker("").addSourceDec(addr, dec))
            case Some(mk) => ec.label = Some(mk.addSourceDec(addr, dec))
          }
        } else {
          val dec = EdgeDecoration(decShape, decColor, true)
          ec.label match {
            case None => ec.label = Some(SimpleMarker("").withTargetDec(Some(dec)))
            case Some(mk) => ec.label = Some(mk.withTargetDec(Some(dec)))
          }
        }

        editor.refreshEditor
        showRootFace

      })
    })

  }

  def showRootFace: Unit = 
    for {
      face <- editor.rootFace
    } { viewer.complex = Some(face) }

  def updateFillColor: Unit = {

    editor.updateLabel({
      case None => Some(SimpleMarker("").withFill(fillColor))
      case Some(mk) => Some(mk.withFill(fillColor))
    })

    showRootFace

  }

  def updateStrokeColor: Unit = {

    editor.updateLabel({
      case None => Some(SimpleMarker("").withStroke(strokeColor))
      case Some(mk) => Some(mk.withStroke(strokeColor))
    })

    showRootFace

  }

  def exportSketch: Unit = 
    for {
      c <- viewer.complex
    } {

      def quotStr(str: String): String = "\"" + str + "\""

      val lc = c.map(om => om match {
        case None => quotStr("empty")
        case Some(mk) => quotStr(mk.lbl)
      })
      
      println(lc.toString)

    }

  def renderSketch: Unit = 
    for {
      c <- viewer.complex
    } {

      import upickle.default._
      import opetopic.net._

      val renderData : String = complexToJson(c)
      val sizingMethod : String = write(Percentage(0.05))

      jQuery("#render-data").value(renderData)
      jQuery("#sizing-mthd").value(sizingMethod)
      jQuery("#render-request-form").submit()

    }

  def deleteSelectedSketch: Unit = 
    for { (id, _) <- selectedSketch } {

      import upickle.default._
      import opetopic.net.DeleteSketchRequest

      val req = DeleteSketchRequest(id)

      dom.ext.Ajax.post(
        url = "/deleteSketch",
        data = write(req),
        headers = Map(
          ("X-Requested-With" -> "*"),
          ("CSRF-Token" -> "nocheck")
        ),
        withCredentials = true
      ).map(_.responseText).foreach(text => {
        println("Response: " + text)
      })
    }

  def loadSelectedSketch: Unit = 
    for { (id, _) <- selectedSketch } {

      import upickle.default._
      import opetopic.net.LoadSketchRequest

      val req = LoadSketchRequest(id)

      dom.ext.Ajax.post(
        url = "/getSketch",
        data = write(req),
        headers = Map(
          ("X-Requested-With" -> "*"),
          ("CSRF-Token" -> "nocheck")
        ),
        withCredentials = true
      ).map(_.responseText).foreach(json => {

        val c : SComplex[Option[SimpleMarker]] =
          complexFromJson[Option[SimpleMarker]](upickle.json.read(json))

        editor.newEditor(c)

      })
    }

  def saveSketch: Unit = 
    for {
      c <- viewer.complex
    } {

      import org.scalajs.dom
      import upickle.default._
      import opetopic.net.SaveSketchRequest

      jQuery("#save-modal").modal(lit(
        onApprove = () => {

          val req =
            SaveSketchRequest(
              jQuery("#sketch-name-input").value.asInstanceOf[String],
              jQuery("#sketch-path-input").value.asInstanceOf[String],
              jQuery("#sketch-desc-input").value.asInstanceOf[String],
              complexToJson(c)
            )

          dom.ext.Ajax.post(
            url = "/saveSketch",
            data = write(req),
            headers = Map(
              ("X-Requested-With" -> "*"),
              ("CSRF-Token" -> "nocheck")
            ),
            withCredentials = true
          ) // .map(_.responseText).foreach(println)

        }
      )).modal("show")

    }

  def showProps(c: EditorCell): Unit = {

    for { f <- c.face } {
      if (f.length > 1) {

        val dim = f.length - 1

        if (dim > 0) {
          frameViewer.firstPanel = Some(dim)
          frameViewer.lastPanel = Some(dim)
        }

        frameViewer.complex = Some(f)

      } 
    }

    c.label match {
      case None => {
        showFill("white")
        showStroke("black")
        jQuery("#label-input").value("")
      }
      case Some(mk) => {
        showFill(mk.colorSpec.fillColor)
        showStroke(mk.colorSpec.strokeColor)
        jQuery("#label-input").value(mk.lbl)
      }
    }
  }

  def showFill(str: String): Unit = {
    jQuery("#fill-color-btn").removeClass(fillColor).addClass(str).popup("hide")
    fillColor = str
  }

  def showStroke(str: String): Unit = {
    jQuery("#stroke-color-btn").removeClass(strokeColor).addClass(str).popup("hide")
    strokeColor = str
  }

}
