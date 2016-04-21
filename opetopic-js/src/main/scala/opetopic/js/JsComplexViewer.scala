/**
  * JsComplexViewer.scala - A Client side complex viewer
  * 
  * @author Eric Finster
  * @version 0.1 
  */

package opetopic.js

import org.scalajs.dom
import org.scalajs.jquery._
import scalatags.JsDom.all._
import scala.scalajs.js.Dynamic.{literal => lit}

import opetopic._
import JsDomFramework._
import JQuerySemanticUI._

abstract class JsComplexViewer[A[_ <: Nat]](divHeight: Int = 200) { thisJsViewer =>

  implicit val vf: VisualizableFamily[A]
  def config: GalleryConfig = GalleryConfig()

  var minY : Int = 5000

  private var activeComplex : Option[FiniteComplex[A]] = None
  var activeGallery : Option[ActiveGallery[A]] = None

  def complex: Option[FiniteComplex[A]] = activeComplex
  def complex_=(copt: Option[FiniteComplex[A]]): Unit = {
    activeComplex = copt
    copt match {
      case None => jQuery(uiElement).empty()
      case Some(c) => {

        val gallery = ActiveGallery(c, config)

        gallery.onRefresh = () => { 

          val bnds = gallery.bounds

          val newBnds =
            if (minY < bnds.height)
              bnds
            else {
              val offset = minY - bnds.height
              bnds.copy(y = bnds.y - (offset / 2), height = minY)
            }

          gallery.galleryViewport.setBounds(newBnds) 

        }

        gallery.galleryViewport.width = viewerWidth
        gallery.galleryViewport.height = viewerHeight

        gallery.refreshAll
        jQuery(uiElement).empty().append(gallery.element.uiElement)
        activeGallery = Some(gallery)

      }
    }
  }

  var viewerWidth : Int = 0
  var viewerHeight : Int = 0

  val uiElement = 
    div(style := "min-height: " + divHeight.toString + "px").render

  def initialize: Unit = {
    viewerHeight = jQuery(uiElement).height.toInt - 10
    jQuery(dom.window).on("resize", () => { resizeViewer })
    resizeViewer
  }

  def resizeViewer: Unit = {

    viewerWidth = jQuery(uiElement).width.toInt

    for { gallery <- activeGallery } { 
      gallery.galleryViewport.width = viewerWidth
    }

  }

}