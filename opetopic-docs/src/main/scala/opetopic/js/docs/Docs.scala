/**
  * Tutorial.scala - Main Entry for Opetopic Tutorial
  * 
  * @author Eric Finster
  * @version 0.1 
  */

package opetopic.js.docs

import scala.scalajs.{js => sjs}
import sjs.Dynamic.{literal => lit}
import scala.scalajs.js.JSApp
import org.scalajs.dom._
import org.scalajs.jquery._
import scalatags.JsDom.all._

import opetopic._
import opetopic.ui._
import opetopic.js._
import JQuerySemanticUI._
import JsDomFramework._
import syntax.complex._

object Docs extends JSApp {

  import Examples._

  object DocsGalleryConfig extends GalleryConfig (
    panelConfig = PanelConfig(),
    width = 600,
    height = 350,
    spacing = 1500,
    minViewX = Some(60000),
    minViewY = Some(6000),
    spacerBounds = Bounds(0, 0, 600, 600),
    manageViewport = true
  )

  object TutorialColorSpec extends ColorSpec(
    fill = "#f5f5f5",
    fillHovered = "#f19091",
    fillSelected = "#DCDDDE",
    stroke = "#000000",
    strokeHovered = "#000000",
    strokeSelected = "#000000"
  )

  implicit def optStrFamily : VisualizableFamily[OptStr] =
    new VisualizableFamily[OptStr] {
      def visualize[N <: Nat](n: N)(o: OptStr[N]) =
        o match {
          case None => Visualization(n)(TutorialColorSpec, spacer(DocsGalleryConfig.spacerBounds))
          case Some(s) => Visualization(n)(TutorialColorSpec, text(s))
        }
    }

  def main: Unit = {

    println("Started Opetopic Interactive Documentation ...")

    jQuery("#nav-accordion").accordion()

    for {
      pageName <- jQuery("meta[name=page]").attr("content").toOption
    } {
      pageName match {
        case "basicediting" => runBasicEditingPage
        case "diagrams/complexes" => doComplexes
        case "diagrams/opetopes" => doOpetopes
        case "diagrams/geometry" => doGeometry
        case _ => ()
      }
    }

  }

  def doOpetopes: Unit = {

    println("Starting the opetopes page ...")

    val viewer = new DocsViewer(350)
    jQuery("#gallery-pane").append(viewer.uiElement)
    viewer.initialize

    viewer.complex = Some(threecell)

    val faceViewer = new DocsViewer
    jQuery("#face-pane").append(faceViewer.uiElement)
    faceViewer.initialize

    viewer.activeGallery map (g => {
      g.onSelectAsRoot = (bs: Sigma[g.GalleryBoxType]) => {
        for { lc <- bs.value.labelComplex } { faceViewer.complex = Some(lc) }
      }
    })

  }
    
  def runBasicEditingPage: Unit = {

    val editor = new DocsEditor

    jQuery("#editor-div").append(editor.uiElement)
    editor.initialize

  }

  def doComplexes: Unit = {

    jQuery(".ui.checkbox").checkbox(lit(

      onChecked = () => {
        println("checked")
        jQuery("#atoms").fadeTo("slow", 0.0)
        jQuery("#bond").fadeTo("slow", 1.0)
      },

      onUnchecked = () => {
        println("unchecked")
        jQuery("#atoms").fadeTo("slow", 1.0)
        jQuery("#bond").fadeTo("slow", 0.0)
      }

    ))

    jQuery("#cbtn").on("click", () => {
      jQuery("#cbtn").addClass("active")
      jQuery("#fbtn").removeClass("active")
      jQuery("#sbtn").removeClass("active")
      jQuery("#csvg").fadeTo("slow", 1.0)
      jQuery("#fsvg").fadeTo("slow", 0.0)
      jQuery("#ssvg").fadeTo("slow", 0.0)
    })

    jQuery("#fbtn").on("click", () => {
      jQuery("#cbtn").removeClass("active")
      jQuery("#fbtn").addClass("active")
      jQuery("#sbtn").removeClass("active")
      jQuery("#csvg").fadeTo("slow", 0.0)
      jQuery("#fsvg").fadeTo("slow", 1.0)
      jQuery("#ssvg").fadeTo("slow", 0.0)
    })

    jQuery("#sbtn").on("click", () => {
      jQuery("#cbtn").removeClass("active")
      jQuery("#fbtn").removeClass("active")
      jQuery("#sbtn").addClass("active")
      jQuery("#csvg").fadeTo("slow", 0.0)
      jQuery("#fsvg").fadeTo("slow", 0.0)
      jQuery("#ssvg").fadeTo("slow", 1.0)
    })

  }

  def doGeometry: Unit = {

    val viewer = new DocsViewer(350)
    jQuery("#gallery-pane").append(viewer.uiElement)
    viewer.initialize

    viewer.complex = Some(threecell)

    val hoveredStroke = "#ff2a2a"
    val hoveredFill = "#ff2a2a"

    val unhoveredStroke = "#000000"
    val unhoveredFill = "#000000"

    val hoveredAuxFill = TutorialColorSpec.fillHovered
    val unhoveredAuxFill = "#000000"

    def lblToClass(str: String) : String =
      str match {
        case "\u03b1" => "alpha"
        case "\u03b2" => "beta"
        case "\u03b3" => "gamma"
        case "\u03b4" => "delta"
        case "\u03b5" => "epsilon"
        case "\u03b6" => "zeta"
        case "\u03a6" => "phi"
        case _ => str
      }

    // // gallery.onSelectAsRoot = (bs: Sigma[gallery.GalleryBoxType]) => {
    // //   for {
    // //     lc <- bs.value.labelComplex
    // //   } {
    // //     val faceGallery = ActiveGallery(lc)
    // //     jQuery("#face-pane").empty().append(faceGallery.element.uiElement)
    // //   }
    // // }

    val el = Snap("#svg")

    for {
      gallery <- viewer.activeGallery
    } {
      gallery.onHover = (bs : Sigma[gallery.GalleryBoxType]) => {
        for {
          lbl <- bs.value.label
        } {
          el.selectAll(".stroke-" + lblToClass(lbl)).attr(lit(stroke = hoveredStroke))
          el.selectAll(".fill-" + lblToClass(lbl)).attr(lit(fill = hoveredFill))
        }
      }

      gallery.onUnhover = (bs : Sigma[gallery.GalleryBoxType]) => {
        for {
          lbl <- bs.value.label
        } {
          el.selectAll(".stroke-" + lblToClass(lbl)).attr(lit(stroke = unhoveredStroke))
          el.selectAll(".fill-" + lblToClass(lbl)).attr(lit(fill = unhoveredFill))
        }
      }
    }

    Snap.load("/assets/svgs/threecell.svg", (f: Fragment) => {
      el.append(f)
    })

  }

}

