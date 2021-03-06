/**
  * StaticStableGallery.scala - A Static Gallery for static rendering
  * 
  * @author Eric Finster
  * @version 0.1 
  */

package opetopic.ui

import opetopic._
import opetopic.mtl._

abstract class StaticStableGallery[F <: UIFramework](frmwk: F) 
    extends StableGallery[F](frmwk) {

  import framework._
  import isNumeric._

  type PanelType <: StaticPanel
  type CellType <: StaticCell

  def element: Element = {

    val (bnds, els) = panelElementsAndBounds

    val w = layoutWidth(bnds)
    val h = layoutHeight(bnds)
    val vp = layoutViewport(bnds)

    viewport(w, h, vp, els.toList: _*)

  }

  abstract class StaticCell extends GalleryCell { thisCell : CellType => 

    def boxElement: Element = {

      val boxRect = rect(
        x, y, width, height, cornerRadius, 
        colorSpec.stroke, strokeWidth, colorSpec.fill
      )

      val labelXPos = x + width - strokeWidth - internalPadding - labelWidth
      val labelYPos = y + height - strokeWidth - internalPadding - labelHeight

      val tl = translate(labelElement, labelXPos - labelBounds.x, labelYPos - labelBounds.y)

      group(boxRect, tl)

    }

    def edgeElement: Element = {

      val p = path(pathString, "black", strokeWidth, "none")

      val decs = 
        edgeDecorations.map((dm: DecorationMarker) => {
          translate(dm.be.element, dm.rootX - half(dm.be.bounds.width), dm.rootY)
        })

      group(p +: decs.toSeq : _*)

    }

  }

  trait StaticPanel extends StablePanel { thisPanel : PanelType => 

    def element: Element = {

      val (extCells, intCells) =
        boxNesting.toList.partition(_.isExternal)

      val edges =
        if (boxNesting.baseValue.dim > 0)
          edgeNesting.toList
        else List()

      group(
        intCells.map(_.boxElement) ++
          edges.map(_.edgeElement) ++
          extCells.map(_.boxElement) : _*
      )

    }

  }


}


