const { Plugin } = require('powercord/entities')
const { Icon } = require('powercord/components')
const { findInReactTree } = require('powercord/util')
const { getModule, getModuleByDisplayName, i18n: { Messages }, React } = require('powercord/webpack')
const { inject, uninject } = require('powercord/injector')

module.exports = class QuickMarkAsRead extends Plugin {
    async startPlugin() {
        const classes = await getModule(['iconItem'])
        const { ack, ackCategory } = await getModule(['ack', 'ackCategory'])
        const { hasCategoryUnread } = await getModule(['hasCategoryUnread'])
        const Tooltip = await getModuleByDisplayName('Tooltip')

        const ChannelItem = await getModuleByDisplayName('ChannelItem')
        inject('qmar', ChannelItem.prototype, 'renderIcons', function (_, res) {
            if (!res || !this.props.unread) return res
            const children = findInReactTree(res, c => Array.isArray(c))
            if (!children || children.find(c => c?.props?.__qmar)) return res

            children.unshift(React.createElement('div', { className: classes.iconItem, __qmar: true }, React.createElement(
                Tooltip,
                { text: Messages.MARK_AS_READ },
                props => React.createElement(Icon, {
                    ...props,
                    name: 'ChatCheck',
                    className: classes.actionIcon,
                    width: 18,
                    onClick: () => ack(this.props.channel.id)
                })
            )))

            return res
        })

        const ChannelCategoryItem = await getModuleByDisplayName('ChannelCategoryItem')
        inject('qmar-category', ChannelCategoryItem.prototype, 'renderIcons', function (_, res) {
            if (!res?.props || !hasCategoryUnread(this.props.channel.id)) return res
            if (!Array.isArray(res.props.children)) res.props.children = [ res.props.children ]
            if (res.props.children.find(c => c?.props?.text == Messages.MARK_AS_READ)) return res

            res.props.children.unshift(React.createElement(
                Tooltip,
                { text: Messages.MARK_AS_READ },
                props => React.createElement(Icon, {
                    ...props,
                    name: 'ChatCheck',
                    className: classes.actionIcon,
                    style: { zIndex: 1 },
                    width: 18,
                    onClick: () => ackCategory(this.props.channel.id)
                })
            ))

            return res
        })
    }

    pluginWillUnload() {
        uninject('qmar')
        uninject('qmar-category')
    }
}
