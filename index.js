const { Plugin } = require('powercord/entities')
const { Icon } = require('powercord/components')
const { findInReactTree } = require('powercord/util')
const { getModule, getModuleByDisplayName, i18n: { Messages }, React } = require('powercord/webpack')
const { inject, uninject } = require('powercord/injector')

module.exports = class QuickMarkAsRead extends Plugin {
    buttons = []

    async startPlugin() {
        const _this = this
        const classes = await getModule(['iconItem'])
        const { ack, ackCategory } = await getModule(['ack', 'ackCategory'])
        const { hasCategoryUnread } = await getModule(['hasCategoryUnread'])
        const Tooltip = await getModuleByDisplayName('Tooltip')

        const ChannelItem = await getModule(m => m.default && m.default.displayName == 'ChannelItem')
        inject('qmar', ChannelItem, 'default', args => {
            this.buttons.filter(b => b.props.channelId == args[0]?.channel?.parent_id).forEach(b => b.forceUpdate())
            if (!args[0]?.unread || args[0].children.find(c => c?.props?.__qmar)) return args
            args[0].children.unshift(React.createElement(
                'div', { className: classes.iconItem, __qmar: true }, React.createElement(
                    Tooltip, { text: Messages.MARK_AS_READ }, props => React.createElement(Icon, {
                        ...props,
                        name: 'ChatCheck',
                        className: classes.actionIcon,
                        width: 16,
                        height: 16,
                        onClick: () => ack(args[0].channel.id)
                    })
                )
            ))
            return args
        }, true)
        ChannelItem.default.displayName = 'ChannelItem'

        class QMARCategoryButton extends React.PureComponent {
            constructor(props) {
                super(props)

                _this.buttons.push(this)
            }

            componentWillUnmount() {
                const i = _this.buttons.indexOf(this)
                if (i != -1) _this.buttons.splice(i, 1)
            }

            render() {
                if (hasCategoryUnread(this.props.channelId)) return React.createElement(
                    Tooltip,
                    { text: Messages.MARK_AS_READ },
                    props => React.createElement(Icon, {
                        ...props,
                        name: 'ChatCheck',
                        className: classes.actionIcon,
                        style: { zIndex: 1 },
                        width: 18,
                        onClick: () => ackCategory(this.props.channelId)
                    })
                )
                return null
            }
        }

        const ChannelCategoryItem = await getModule(m => m.default && m.default.displayName == 'ChannelCategoryItem')
        inject('qmar-category', ChannelCategoryItem, 'default', args => {
            if (!Array.isArray(args[0].children)) args[0].children = [ args[0].children ]
            if (args[0].children.find(c => c?.type?.name == 'QMARCategoryButton')) return args

            args[0].children.unshift(React.createElement(QMARCategoryButton, { channelId: args[0].channel.id }))

            return args
        }, true)
        ChannelCategoryItem.default.displayName = 'ChannelCategoryItem'
    }

    pluginWillUnload() {
        uninject('qmar')
        uninject('qmar-category')
    }
}
