/**
  * JsEditor.scala - A Cardinal Editor in JavaScript
  * 
  * @author Eric Finster
  * @version 0.1 
  */

package opetopic.js

import scala.scalajs._
import org.scalajs.dom._

import js.annotation.JSExport

import opetopic.ui._
import scalatags.JsDom.all._

object JsEditor extends js.JSApp {

  object ScalatagsJsDomFramework extends ScalatagsFramework(scalatags.JsDom) {

    implicit val defaultPanelConfig = 
      PanelConfig(
        internalPadding = 200,
        externalPadding = 400,
        leafWidth = 100,
        strokeWidth = 60,
        cornerRadius = 100
      )

    implicit val defaultGalleryConfig = 
      GalleryConfig(defaultPanelConfig, 800)

  }

  def main : Unit = {

    println("Launched Opetopic.")

    renderActiveGallery

  }

  //============================================================================================
  // EXPERIMENTS
  //

  import opetopic.Examples._

  def renderActivePanel : Unit = {

    import JsDomFramework._

    val panel = ActivePanel(fred0)

    val panelSvg = document.createElementNS(svgns, "svg")
    panelSvg.setAttributeNS(null, "width", "800")
    panelSvg.setAttributeNS(null, "height", "600")
    panelSvg.setAttributeNS(null, "viewBox", panel.bounds.dimString)

    panelSvg.appendChild(panel.element.uiElement)

    val div = document.getElementById("middle-pane")
    div.appendChild(panelSvg)

  }

  def renderActiveGallery : Unit = {

    import JsDomFramework._
    import opetopic.syntax.complex._

    val gallery = ActiveGallery(fredComplex)

    val gallerySvg = document.createElementNS(svgns, "svg")
    gallerySvg.setAttributeNS(null, "width", "800")
    gallerySvg.setAttributeNS(null, "height", "600")
    gallerySvg.setAttributeNS(null, "viewBox", gallery.bounds.dimString)

    gallerySvg.appendChild(gallery.element.uiElement)

    val div = document.getElementById("middle-pane")
    div.appendChild(gallerySvg)

  }

  def renderStaticPanel : Unit = {

    import ScalatagsJsDomFramework._

    val panel = StaticPanel(exotic)

    val panelSvg = {

      import bundle.implicits._
      import bundle.svgTags._
      import bundle.svgAttrs._

      svg(width:="800",height:="600",viewBox:=panel.bounds.dimString,xmlns:="http://www.w3.org/2000/svg")(panel.element)

    }

    val div = document.getElementById("middle-pane")
    div.appendChild(panelSvg.render)

  }

  def renderStaticGallery : Unit = {

    import ScalatagsJsDomFramework._
    import opetopic.syntax.complex._

    val gallery = StaticGallery(fredComplex)

    val gallerySvg = {

      import bundle.implicits._
      import bundle.svgTags._
      import bundle.svgAttrs._

      svg(width:="800",height:="600",viewBox:=gallery.bounds.dimString,xmlns:="http://www.w3.org/2000/svg")(gallery.element)

    }

    val div = document.getElementById("middle-pane")
    div.appendChild(gallerySvg.render)

  }

}


